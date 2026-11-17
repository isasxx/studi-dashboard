const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const moduleCatalog = require('./modules');

/**
 * Verbindung zur SQLite-Datenbank.
 * Die Datei studi.db liegt im backend-Ordner und wird beim ersten Start automatisch angelegt.
 */
const db = new Database(path.join(__dirname, 'studi.db'));

// Fremdschlüssel einschalten (sonst ignoriert SQLite "ON DELETE CASCADE")
db.pragma('foreign_keys = ON');

// Tabellen anlegen, falls es sie noch nicht gibt
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    passwordHash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decks (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title  TEXT NOT NULL,
    module TEXT
  );

  CREATE TABLE IF NOT EXISTS cards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    deckId     INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'mittel',
    status     TEXT NOT NULL DEFAULT 'neu'
  );

  CREATE TABLE IF NOT EXISTS modules (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    semester INTEGER NOT NULL,
    ects     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS grades (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    userId   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moduleId INTEGER NOT NULL REFERENCES modules(id),
    grade    REAL NOT NULL,
    attempt  INTEGER NOT NULL DEFAULT 1,
    date     TEXT,
    planned  INTEGER NOT NULL DEFAULT 0
  );
`);

// Modulkatalog einmalig einlesen (gilt für alle Nutzer)
const moduleCount = db.prepare('SELECT COUNT(*) AS n FROM modules').get().n;
if (moduleCount === 0) {
  const insertModule = db.prepare('INSERT INTO modules (name, semester, ects) VALUES (?, ?, ?)');
  for (const m of moduleCatalog) {
    insertModule.run(m.name, m.semester, m.ects);
  }
}

// Beispieldaten nur einfügen, wenn die Datenbank noch leer ist.
// Es gibt einen Demo-Account zum Ausprobieren: demo@example.com / demo1234
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  const demo = db
    .prepare('INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)')
    .run('demo@example.com', 'Demo', bcrypt.hashSync('demo1234', 10)).lastInsertRowid;

  const insertDeck = db.prepare('INSERT INTO decks (userId, title, module) VALUES (?, ?, ?)');
  const insertCard = db.prepare(
    'INSERT INTO cards (deckId, question, answer, difficulty, status) VALUES (?, ?, ?, ?, ?)'
  );

  const statistik = insertDeck.run(demo, 'Statistik', 'Statistik').lastInsertRowid;
  const datenbanken = insertDeck.run(demo, 'Datenbanken', 'Datenbanken').lastInsertRowid;

  insertCard.run(statistik, 'Was ist der Median?', 'Der mittlere Wert einer sortierten Liste', 'leicht', 'neu');
  insertCard.run(statistik, 'Was besagt der zentrale Grenzwertsatz?', 'Mittelwerte vieler Stichproben sind annähernd normalverteilt', 'schwer', 'lernend');
  insertCard.run(datenbanken, 'Was ist ein Primärschlüssel?', 'Ein Attribut, das jede Zeile eindeutig identifiziert', 'leicht', 'gelernt');
  insertCard.run(datenbanken, 'Was ist ein Fremdschlüssel?', 'Ein Verweis auf den Primärschlüssel einer anderen Tabelle', 'mittel', 'neu');
}

module.exports = db;

