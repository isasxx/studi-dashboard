const express = require('express');
const db = require('../db');

const router = express.Router();

// Gültige Noten nach deutschem System
const VALID_GRADES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0];

/**
 * Bestimmt den Status einer Note.
 * @param {object} g - Note mit den Feldern grade und planned
 * @returns {string} 'geplant', 'bestanden' oder 'nicht bestanden'
 */
function statusOf(g) {
  if (g.planned) return 'geplant';
  return g.grade <= 4.0 ? 'bestanden' : 'nicht bestanden';
}

/**
 * Rundet auf zwei Nachkommastellen.
 * @param {number} x
 * @returns {number}
 */
function round2(x) {
  return Math.round(x * 100) / 100;
}

/**
 * Berechnet den ECTS-gewichteten Durchschnitt.
 * @param {Array<{grade: number, ects: number}>} entries
 * @returns {number|null} Durchschnitt, oder null wenn es keine Einträge gibt
 */
function weightedAverage(entries) {
  const ects = entries.reduce((sum, e) => sum + e.ects, 0);
  if (ects === 0) return null;
  const sum = entries.reduce((s, e) => s + e.grade * e.ects, 0);
  return round2(sum / ects);
}

/**
 * Prüft die Eingaben für eine Note.
 * @param {object} body - die mitgeschickten Daten
 * @returns {string|null} Fehlermeldung, oder null wenn alles passt
 */
function validateGrade(body) {
  const module = db.prepare('SELECT id FROM modules WHERE id = ?').get(Number(body.moduleId));
  if (!module) {
    return 'Modul existiert nicht';
  }
  if (!VALID_GRADES.includes(Number(body.grade))) {
    return 'grade muss eine gültige Note sein (1.0, 1.3, … 4.0 oder 5.0)';
  }
  if (body.attempt !== undefined && !(Number(body.attempt) >= 1 && Number(body.attempt) <= 3)) {
    return 'attempt muss 1, 2 oder 3 sein';
  }
  return null;
}

/**
 * Lädt alle Noten des Nutzers zusammen mit den Moduldaten.
 * @param {number} userId
 * @returns {Array<object>}
 */
function loadGrades(userId) {
  return db
    .prepare(
      `SELECT grades.*, modules.name AS moduleName, modules.semester, modules.ects
       FROM grades JOIN modules ON modules.id = grades.moduleId
       WHERE grades.userId = ?
       ORDER BY modules.semester, modules.name, grades.attempt`
    )
    .all(userId)
    .map(g => ({ ...g, planned: Boolean(g.planned), status: statusOf(g) }));
}

/**
 * Liefert die eigenen Noten, optional gefiltert nach Semester und Status.
 * GET /grades?semester=2&status=bestanden
 */
router.get('/', (req, res) => {
  const { semester, status } = req.query;
  let grades = loadGrades(req.user.id);
  if (semester) grades = grades.filter(g => g.semester === Number(semester));
  if (status) grades = grades.filter(g => g.status === status);
  res.json(grades);
});

/**
 * Liefert die Auswertung: Schnitt, geplanter Schnitt, ECTS-Fortschritt
 * und – mit ?target=2.0 – die nötige Durchschnittsnote in den offenen Modulen.
 * GET /grades/summary?target=2.0
 */
router.get('/summary', (req, res) => {
  const grades = loadGrades(req.user.id);
  const modules = db.prepare('SELECT * FROM modules').all();

  // Pro Modul zählt die bestandene Note (es gibt höchstens eine)
  const passed = grades.filter(g => g.status === 'bestanden');
  const passedIds = new Set(passed.map(g => g.moduleId));

  // Geplante Noten nur für Module, die noch nicht bestanden sind
  const planned = grades.filter(g => g.status === 'geplant' && !passedIds.has(g.moduleId));

  const ectsDone = passed.reduce((sum, g) => sum + g.ects, 0);
  const ectsTotal = modules.reduce((sum, m) => sum + m.ects, 0);
  const openModules = modules.filter(m => !passedIds.has(m.id));
  const openEcts = openModules.reduce((sum, m) => sum + m.ects, 0);

  const summary = {
    average: weightedAverage(passed),
    plannedAverage: weightedAverage([...passed, ...planned]),
    ectsDone,
    ectsTotal,
    progress: ectsTotal > 0 ? round2(ectsDone / ectsTotal) : 0,
    passedModules: passed.length,
    openModules: openModules.length
  };

  // Zielschnitt: Welche Durchschnittsnote braucht man in den offenen Modulen?
  if (req.query.target !== undefined) {
    const target = Number(req.query.target);
    if (!(target >= 1.0 && target <= 4.0)) {
      return res.status(400).json({ error: 'target muss zwischen 1.0 und 4.0 liegen' });
    }
    if (openEcts === 0) {
      summary.goal = { target, required: null, reachable: summary.average !== null && summary.average <= target };
    } else {
      const doneSum = passed.reduce((s, g) => s + g.grade * g.ects, 0);
      const required = round2((target * (ectsDone + openEcts) - doneSum) / openEcts);
      summary.goal = { target, required, reachable: required >= 1.0 };
    }
  }

  res.json(summary);
});

/**
 * Trägt eine Note ein.
 * POST /grades – Body: { moduleId, grade, attempt?, date?, planned? }
 */
router.post('/', (req, res) => {
  const error = validateGrade(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { moduleId, grade, attempt, date, planned } = req.body;
  const info = db
    .prepare('INSERT INTO grades (userId, moduleId, grade, attempt, date, planned) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, Number(moduleId), Number(grade), Number(attempt) || 1, date ?? null, planned ? 1 : 0);
  const created = loadGrades(req.user.id).find(g => g.id === info.lastInsertRowid);
  res.status(201).json(created);
});

/**
 * Ändert eine Note.
 * PUT /grades/:id – Body: { moduleId, grade, attempt?, date?, planned? }
 */
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM grades WHERE id = ? AND userId = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Note nicht gefunden' });
  }
  const error = validateGrade(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const { moduleId, grade, attempt, date, planned } = req.body;
  db.prepare(
    'UPDATE grades SET moduleId = ?, grade = ?, attempt = ?, date = ?, planned = ? WHERE id = ?'
  ).run(Number(moduleId), Number(grade), Number(attempt) || existing.attempt, date ?? existing.date, planned ? 1 : 0, id);
  res.json(loadGrades(req.user.id).find(g => g.id === id));
});

/**
 * Löscht eine Note.
 * DELETE /grades/:id
 */
router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM grades WHERE id = ? AND userId = ?')
    .run(Number(req.params.id), req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Note nicht gefunden' });
  }
  res.status(204).end();
});

module.exports = router;
