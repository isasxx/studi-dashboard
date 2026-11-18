const express = require('express');
const db = require('../db');

const router = express.Router();

// Gültige Noten nach deutschem System
const VALID_GRADES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0];

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
 * @param {Array<{grade: number, ects: number}>} entries - nur benotete Einträge
 * @returns {number|null} Durchschnitt, oder null wenn es keine Einträge gibt
 */
function weightedAverage(entries) {
  const ects = entries.reduce((sum, e) => sum + e.ects, 0);
  if (ects === 0) return null;
  const sum = entries.reduce((s, e) => s + e.grade * e.ects, 0);
  return round2(sum / ects);
}

/**
 * Prüft die Eingaben für eine Note und bereitet sie zum Speichern auf.
 * Erlaubt sind entweder eine Note (grade) oder – für unbenotete Module –
 * grade: null zusammen mit passed: true/false.
 * @param {object} body - die mitgeschickten Daten
 * @returns {{error: string} | {grade: number|null, passed: number}}
 */
function parseGrade(body) {
  const module = db.prepare('SELECT id FROM modules WHERE id = ?').get(Number(body.moduleId));
  if (!module) {
    return { error: 'Modul existiert nicht' };
  }
  if (body.attempt !== undefined && !(Number(body.attempt) >= 1 && Number(body.attempt) <= 3)) {
    return { error: 'attempt muss 1, 2 oder 3 sein' };
  }

  // Unbenotet: nur bestanden oder nicht bestanden
  if (body.grade === null || body.grade === undefined) {
    if (typeof body.passed !== 'boolean') {
      return { error: 'Ohne Note muss passed (true oder false) angegeben werden' };
    }
    return { grade: null, passed: body.passed ? 1 : 0 };
  }

  // Benotet: Note prüfen, bestanden ergibt sich aus der Note
  const grade = Number(body.grade);
  if (!VALID_GRADES.includes(grade)) {
    return { error: 'grade muss eine gültige Note sein (1.0, 1.3, … 4.0 oder 5.0)' };
  }
  return { grade, passed: grade <= 4.0 ? 1 : 0 };
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
    .map(g => ({
      ...g,
      passed: Boolean(g.passed),
      graded: g.grade !== null,
      status: g.passed ? 'bestanden' : 'nicht bestanden'
    }));
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
 * Liefert die Auswertung: Schnitt, ECTS-Fortschritt
 * und – mit ?target=2.0 – die nötige Durchschnittsnote in den offenen Modulen.
 * GET /grades/summary?target=2.0
 */
router.get('/summary', (req, res) => {
  const grades = loadGrades(req.user.id);
  const modules = db.prepare('SELECT * FROM modules').all();

  // Bestandene Module zählen für die ECTS, in den Schnitt gehen nur die benoteten
  const passed = grades.filter(g => g.passed);
  const passedGraded = passed.filter(g => g.graded);
  const passedIds = new Set(passed.map(g => g.moduleId));

  const ectsDone = passed.reduce((sum, g) => sum + g.ects, 0);
  const ectsTotal = modules.reduce((sum, m) => sum + m.ects, 0);
  const openModules = modules.filter(m => !passedIds.has(m.id));
  const openEcts = openModules.reduce((sum, m) => sum + m.ects, 0);

  const summary = {
    average: weightedAverage(passedGraded),
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
      const gradedEcts = passedGraded.reduce((s, g) => s + g.ects, 0);
      const doneSum = passedGraded.reduce((s, g) => s + g.grade * g.ects, 0);
      const required = round2((target * (gradedEcts + openEcts) - doneSum) / openEcts);
      summary.goal = { target, required, reachable: required >= 1.0 };
    }
  }

  res.json(summary);
});

/**
 * Trägt eine Note ein.
 * POST /grades – Body: { moduleId, grade, attempt?, date? }
 * Für unbenotete Module: { moduleId, grade: null, passed: true|false, attempt?, date? }
 */
router.post('/', (req, res) => {
  const parsed = parseGrade(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const { moduleId, attempt, date } = req.body;
  const info = db
    .prepare('INSERT INTO grades (userId, moduleId, grade, passed, attempt, date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, Number(moduleId), parsed.grade, parsed.passed, Number(attempt) || 1, date ?? null);
  const created = loadGrades(req.user.id).find(g => g.id === info.lastInsertRowid);
  res.status(201).json(created);
});

/**
 * Ändert eine Note.
 * PUT /grades/:id – Body wie bei POST
 */
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM grades WHERE id = ? AND userId = ?').get(id, req.user.id);
  if (!existing) {
    return res.status(404).json({ error: 'Note nicht gefunden' });
  }
  const parsed = parseGrade(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  const { moduleId, attempt, date } = req.body;
  db.prepare(
    'UPDATE grades SET moduleId = ?, grade = ?, passed = ?, attempt = ?, date = ? WHERE id = ?'
  ).run(Number(moduleId), parsed.grade, parsed.passed, Number(attempt) || existing.attempt, date ?? existing.date, id);
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
