const express = require('express');
const ical = require('node-ical');
const db = require('../db');
const courses = require('../courses');

const router = express.Router();

// Alle wie viele Minuten der Stundenplan automatisch neu von der HWR geladen wird
const REFRESH_MINUTES = Number(process.env.TIMETABLE_REFRESH_MINUTES) || 30;
const MAX_AGE_MS = REFRESH_MINUTES * 60 * 1000;

/**
 * Sucht den Kurs, zu dem eine gespeicherte Stundenplan-Adresse gehört.
 * @param {string} url
 * @returns {object|null} der Kurs ohne die Adresse, oder null
 */
function courseForUrl(url) {
  const course = courses.find(c => c.url === url);
  if (!course) return null;
  const { url: _url, ...publicData } = course;
  return publicData;
}

/**
 * Lädt die ICS-Datei von der HWR herunter.
 * @param {string} url
 * @returns {Promise<string>} der Inhalt der Kalenderdatei
 * @throws {Error} wenn die HWR nicht erreichbar ist oder keine Kalenderdatei liefert
 */
async function downloadIcs(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Der HWR-Server antwortet mit Fehler ${response.status}`);
  }
  const text = await response.text();
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Unter dieser Adresse liegt keine Kalenderdatei (ICS)');
  }
  return text;
}

/**
 * Liest einen Text aus einem ICS-Feld (manchmal ein String, manchmal ein Objekt mit .val).
 * @param {string|{val: string}|undefined} value
 * @returns {string}
 */
function text(value) {
  if (!value) return '';
  return typeof value === 'object' ? String(value.val ?? '') : String(value);
}

/**
 * Zerlegt den Titel eines HWR-Termins in seine Teile.
 * Die HWR schreibt alles mit Semikolons getrennt in den Titel, z. B.
 * "SU;IT2111 - Verteilte Systeme;Kalkbrenner;CL: 6B.450 (T);Kurs B - ONLINE"
 * = Art; Modulnummer - Modul; Lehrende; Raum; Hinweis.
 * Termine in einem anderen Format werden einfach als Titel übernommen.
 * @param {string} summary - der Titel aus der ICS-Datei
 * @param {string} location - der Ort aus der ICS-Datei
 * @returns {{type: string, code: string, title: string, lecturer: string, room: string, note: string}}
 */
function parseHwrSummary(summary, location) {
  const cleanRoom = value => value.replace(/^CL:\s*/, '').trim();
  const parts = summary.split(';').map(part => part.trim());

  if (parts.length < 3) {
    return { type: '', code: '', title: summary, lecturer: '', room: cleanRoom(location), note: '' };
  }

  const [type, name, lecturer = '', room = '', note = ''] = parts;
  // "IT2111 - Verteilte Systeme" -> Modulnummer und Name trennen
  const match = name.match(/^([A-Z]+\d+)\s*-\s*(.+)$/);
  return {
    type,
    code: match ? match[1] : '',
    title: match ? match[2] : name,
    lecturer,
    room: cleanRoom(room || location),
    note
  };
}

/**
 * Wandelt die ICS-Datei in eine Liste von Terminen in einem Zeitraum um.
 * Wiederkehrende Termine (z. B. "jede Woche") werden dabei aufgefächert.
 * @param {string} ics - Inhalt der Kalenderdatei
 * @param {Date} from - Beginn des Zeitraums
 * @param {Date} to - Ende des Zeitraums
 * @returns {Array<object>} Termine mit start, end und den Teilen aus parseHwrSummary
 */
function eventsInRange(ics, from, to) {
  const calendar = ical.sync.parseICS(ics);
  const events = [];
  for (const entry of Object.values(calendar)) {
    if (entry.type !== 'VEVENT') continue;
    for (const instance of ical.expandRecurringEvent(entry, { from, to })) {
      events.push({
        start: instance.start.toISOString(),
        end: instance.end.toISOString(),
        ...parseHwrSummary(text(instance.summary || entry.summary), text(entry.location))
      });
    }
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Speichert Adresse und Inhalt des Stundenplans für einen Nutzer (neu oder überschreiben).
 * @param {number} userId
 * @param {string} url
 * @param {string} ics
 */
function saveTimetable(userId, url, ics) {
  db.prepare(
    `INSERT INTO timetables (userId, url, ics, fetchedAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(userId) DO UPDATE SET url = excluded.url, ics = excluded.ics, fetchedAt = excluded.fetchedAt`
  ).run(userId, url, ics, new Date().toISOString());
}

/**
 * Lädt alle gespeicherten Stundenpläne neu von der HWR.
 * Klappt es bei einem nicht, bleibt der alte Stand – beim nächsten Durchlauf wird es erneut versucht.
 * @returns {Promise<number>} wie viele Stundenpläne aktualisiert wurden
 */
async function refreshAll() {
  const timetables = db.prepare('SELECT userId, url FROM timetables').all();
  let updated = 0;
  for (const t of timetables) {
    try {
      saveTimetable(t.userId, t.url, await downloadIcs(t.url));
      updated++;
    } catch {
      // HWR gerade nicht erreichbar – nächstes Mal wieder versuchen
    }
  }
  return updated;
}

/**
 * Startet die automatische Aktualisierung im Hintergrund:
 * Alle REFRESH_MINUTES Minuten werden alle Stundenpläne neu geladen –
 * auch wenn gerade niemand die App geöffnet hat.
 * @returns {NodeJS.Timeout} der Timer (zum Stoppen mit clearInterval)
 */
function startAutoRefresh() {
  const timer = setInterval(refreshAll, MAX_AGE_MS);
  timer.unref(); // hält den Server nicht künstlich am Leben
  return timer;
}

/**
 * Liefert alle Kurse, deren Stundenplan man auswählen kann.
 * GET /timetable/courses
 */
router.get('/courses', (req, res) => {
  res.json(courses.map(({ url, ...course }) => course));
});

/**
 * Liefert die Termine aus dem HWR-Stundenplan für einen Zeitraum.
 * Ist der gespeicherte Plan zu alt oder wird ?refresh=true mitgeschickt, wird er sofort neu geladen.
 * Ist die HWR nicht erreichbar, kommt der letzte gespeicherte Stand (stale: true).
 * GET /timetable?from=2026-11-16&to=2026-11-23&refresh=true
 */
router.get('/', async (req, res) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const { from, to } = req.query;
  if (!datePattern.test(from || '') || !datePattern.test(to || '')) {
    return res.status(400).json({ error: 'from und to müssen im Format JJJJ-MM-TT angegeben werden' });
  }

  const saved = db.prepare('SELECT * FROM timetables WHERE userId = ?').get(req.user.id);
  if (!saved) {
    return res.json({ configured: false, events: [] });
  }

  let ics = saved.ics;
  let fetchedAt = saved.fetchedAt;
  let stale = false;

  // Zu alt oder ausdrücklich gewünscht? Dann neu von der HWR laden – klappt das nicht, den alten Stand nehmen
  const tooOld = Date.now() - new Date(saved.fetchedAt).getTime() > MAX_AGE_MS;
  if (tooOld || req.query.refresh === 'true') {
    try {
      ics = await downloadIcs(saved.url);
      saveTimetable(req.user.id, saved.url, ics);
      fetchedAt = new Date().toISOString();
    } catch {
      stale = true;
    }
  }

  try {
    const events = eventsInRange(ics, new Date(from), new Date(to));
    res.json({ configured: true, course: courseForUrl(saved.url), fetchedAt, stale, events });
  } catch {
    res.status(500).json({ error: 'Der gespeicherte Stundenplan konnte nicht gelesen werden' });
  }
});

/**
 * Wählt den eigenen Kurs aus und lädt dessen Stundenplan direkt von der HWR.
 * PUT /timetable – Body: { "courseId": "informatik-3-b" }
 */
router.put('/', async (req, res) => {
  const course = courses.find(c => c.id === req.body.courseId);
  if (!course) {
    return res.status(400).json({ error: 'Diesen Kurs gibt es nicht' });
  }

  let ics;
  try {
    ics = await downloadIcs(course.url);
    ical.sync.parseICS(ics); // prüfen, ob die Datei lesbar ist
  } catch (e) {
    // 502 = "Bad Gateway": Die Quelle, von der wir laden, hat nicht richtig geantwortet
    return res.status(502).json({ error: `Stundenplan konnte nicht geladen werden: ${e.message}` });
  }

  saveTimetable(req.user.id, course.url, ics);
  res.json({ configured: true, course: courseForUrl(course.url), fetchedAt: new Date().toISOString() });
});

module.exports = router;
module.exports.startAutoRefresh = startAutoRefresh;
