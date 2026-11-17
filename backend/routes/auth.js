const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

/**
 * Legt ein neues Konto an.
 * POST /auth/register – Body: { "name": "...", "email": "...", "password": "..." }
 */
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email und password sind Pflicht' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'email ist ungültig' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password muss mindestens 8 Zeichen haben' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Diese E-Mail ist schon registriert' });
  }

  // Passwort nie im Klartext speichern – nur den Hash
  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)')
    .run(email, name, passwordHash);

  res.status(201).json({ id: info.lastInsertRowid, email, name });
});

/**
 * Prüft E-Mail und Passwort.
 * POST /auth/login – Body: { "email": "...", "password": "..." }
 * Das Frontend schickt die Zugangsdaten danach bei jeder Anfrage per Basic Auth mit.
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
  }
  res.json({ id: user.id, email: user.email, name: user.name });
});

module.exports = router;
