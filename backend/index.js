// Express laden und eine App erstellen
const express = require('express');
const requireAuth = require('./middleware/auth');
const authRouter = require('./routes/auth');
const decksRouter = require('./routes/decks');
const cardsRouter = require('./routes/cards');

const app = express();
app.use(express.json()); // erlaubt JSON in Anfragen

// Registrierung und Login sind offen, alles andere nur mit Anmeldung
app.use('/auth', authRouter);
app.use('/decks', requireAuth, decksRouter);
app.use('/cards', requireAuth, cardsRouter);

// Server starten
app.listen(3000, () => {
  console.log('Server läuft auf Port 3000');
});
