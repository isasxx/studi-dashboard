const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * Sucht einen Stapel, der dem angemeldeten Nutzer gehört.
 * @param {number} id - ID des Stapels
 * @param {number} userId - ID des angemeldeten Nutzers
 * @returns {object|undefined} der Stapel, oder undefined wenn es ihn nicht gibt oder er jemand anderem gehört
 */
function findOwnDeck(id, userId) {
  return db.prepare('SELECT * FROM decks WHERE id = ? AND userId = ?').get(id, userId);
}

/**
 * Liefert alle Stapel des angemeldeten Nutzers.
 * GET /decks
 */
router.get('/', (req, res) => {
  const decks = db.prepare('SELECT * FROM decks WHERE userId = ? ORDER BY id').all(req.user.id);
  res.json(decks);
});

/**
 * Legt einen neuen Stapel an.
 * POST /decks – Body: { "title": "...", "module": "..." }
 */
router.post('/', (req, res) => {
  const { title, module } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title fehlt' });
  }
  const info = db
    .prepare('INSERT INTO decks (userId, title, module) VALUES (?, ?, ?)')
    .run(req.user.id, title, module ?? null);
  res.status(201).json(findOwnDeck(info.lastInsertRowid, req.user.id));
});

/**
 * Ändert einen bestehenden Stapel.
 * PUT /decks/:id – Body: { "title": "...", "module": "..." }
 */
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!findOwnDeck(id, req.user.id)) {
    return res.status(404).json({ error: 'Stapel nicht gefunden' });
  }
  const { title, module } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title fehlt' });
  }
  db.prepare('UPDATE decks SET title = ?, module = ? WHERE id = ?').run(title, module ?? null, id);
  res.json(findOwnDeck(id, req.user.id));
});

/**
 * Löscht einen Stapel. Seine Karten löscht die Datenbank automatisch mit (ON DELETE CASCADE).
 * DELETE /decks/:id
 */
router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM decks WHERE id = ? AND userId = ?')
    .run(Number(req.params.id), req.user.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Stapel nicht gefunden' });
  }
  res.status(204).end();
});

module.exports = router;
