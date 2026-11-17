const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * Liefert den Modulkatalog, optional nach Semester gefiltert.
 * GET /modules?semester=2
 */
router.get('/', (req, res) => {
  const { semester } = req.query;
  const modules = semester
    ? db.prepare('SELECT * FROM modules WHERE semester = ? ORDER BY semester, name').all(Number(semester))
    : db.prepare('SELECT * FROM modules ORDER BY semester, name').all();
  res.json(modules);
});

module.exports = router;
