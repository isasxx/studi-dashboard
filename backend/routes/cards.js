const express = require('express');
const db = require('../db');

const router = express.Router();

// Erlaubte Werte für Karten
const DIFFICULTIES = ['leicht', 'mittel', 'schwer'];
const STATUSES = ['neu', 'lernend', 'gelernt'];

/**
 * Sucht eine Karte, deren Stapel dem angemeldeten Nutzer gehört.
 * @param {number} id - ID der Karte
 * @param {number} userId - ID des angemeldeten Nutzers
 * @returns {object|undefined} die Karte, oder undefined wenn es sie nicht gibt oder sie jemand anderem gehört
 */
function findOwnCard(id, userId) {
  return db
    .prepare(
      `SELECT cards.* FROM cards
       JOIN decks ON decks.id = cards.deckId
       WHERE cards.id = ? AND decks.userId = ?`
    )
    .get(id, userId);
}

/**
 * Prüft die Eingaben für eine Karte.
 * @param {object} body - die mitgeschickten Daten
 * @param {number} userId - ID des angemeldeten Nutzers (der Stapel muss ihm gehören)
 * @returns {string|null} Fehlermeldung, oder null wenn alles passt
 */
function validateCard(body, userId) {
  if (!body.question || !body.answer) {
    return 'question und answer sind Pflicht';
  }
  const deck = db
    .prepare('SELECT id FROM decks WHERE id = ? AND userId = ?')
    .get(Number(body.deckId), userId);
  if (!deck) {
    return 'Stapel existiert nicht';
  }
  if (body.difficulty && !DIFFICULTIES.includes(body.difficulty)) {
    return 'difficulty muss leicht, mittel oder schwer sein';
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return 'status muss neu, lernend oder gelernt sein';
  }
  return null;
}

/**
 * Liefert die Karten des angemeldeten Nutzers mit Filter und Pagination.
 * GET /cards?deck=1&difficulty=schwer&status=neu&q=median&page=1&size=10
 */
router.get('/', (req, res) => {
  const { deck, difficulty, status, q } = req.query;
  const page = Number(req.query.page) || 1;
  const size = Number(req.query.size) || 10;

  if (page < 1 || size < 1) {
    return res.status(400).json({ error: 'page und size müssen mindestens 1 sein' });
  }

  // Immer nur Karten aus den eigenen Stapeln, dazu die mitgeschickten Filter
  const conditions = ['deckId IN (SELECT id FROM decks WHERE userId = ?)'];
  const params = [req.user.id];
  if (deck) {
    conditions.push('deckId = ?');
    params.push(Number(deck));
  }
  if (difficulty) {
    conditions.push('difficulty = ?');
    params.push(difficulty);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (q) {
    conditions.push('(question LIKE ? OR answer LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const where = 'WHERE ' + conditions.join(' AND ');

  // Gesamtzahl (für die Seitenanzeige im Frontend) und den Ausschnitt der aktuellen Seite holen
  const total = db.prepare(`SELECT COUNT(*) AS n FROM cards ${where}`).get(...params).n;
  const data = db
    .prepare(`SELECT * FROM cards ${where} ORDER BY id LIMIT ? OFFSET ?`)
    .all(...params, size, (page - 1) * size);

  res.json({ data, page, size, total });
});

/**
 * Liefert eine einzelne Karte.
 * GET /cards/:id
 */
router.get('/:id', (req, res) => {
  const card = findOwnCard(Number(req.params.id), req.user.id);
  if (!card) {
    return res.status(404).json({ error: 'Karte nicht gefunden' });
  }
  res.json(card);
});

/**
 * Legt eine neue Karte an.
 * POST /cards – Body: { deckId, question, answer, difficulty?, status? }
 */
router.post('/', (req, res) => {
  const error = validateCard(req.body, req.user.id);
  if (error) {
    return res.status(400).json({ error });
  }
  const { deckId, question, answer, difficulty, status } = req.body;
  const info = db
    .prepare('INSERT INTO cards (deckId, question, answer, difficulty, status) VALUES (?, ?, ?, ?, ?)')
    .run(Number(deckId), question, answer, difficulty || 'mittel', status || 'neu');
  res.status(201).json(findOwnCard(info.lastInsertRowid, req.user.id));
});

/**
 * Ändert eine Karte
 * PUT /cards/:id – Body: { deckId, question, answer, difficulty?, status? }
 */
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const card = findOwnCard(id, req.user.id);
  if (!card) {
    return res.status(404).json({ error: 'Karte nicht gefunden' });
  }
  const error = validateCard(req.body, req.user.id);
  if (error) {
    return res.status(400).json({ error });
  }
  const { deckId, question, answer, difficulty, status } = req.body;
  db.prepare(
    'UPDATE cards SET deckId = ?, question = ?, answer = ?, difficulty = ?, status = ? WHERE id = ?'
  ).run(Number(deckId), question, answer, difficulty || card.difficulty, status || card.status, id);
  res.json(findOwnCard(id, req.user.id));
});

/**
 * Löscht eine Karte.
 * DELETE /cards/:id
 */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!findOwnCard(id, req.user.id)) {
    return res.status(404).json({ error: 'Karte nicht gefunden' });
  }
  db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
