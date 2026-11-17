const bcrypt = require('bcryptjs');
const db = require('../db');

/**
 * Prüft die Anmeldung per HTTP Basic Auth.
 * Erwartet den Header "Authorization: Basic <base64(email:passwort)>".
 * Bei Erfolg steht der angemeldete Nutzer danach in req.user, sonst antwortet sie mit 401.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next - ruft den eigentlichen Endpoint auf
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    return unauthorized(res);
  }

  // "Basic ZGVtb0BleGFtcGxlLmNvbTpkZW1vMTIzNA==" -> "demo@example.com:demo1234"
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  const email = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return unauthorized(res);
  }

  req.user = { id: user.id, email: user.email, name: user.name };
  next();
}

/**
 * Antwortet mit 401 Unauthorized.
 * @param {import('express').Response} res
 */
function unauthorized(res) {
  res.set('WWW-Authenticate', 'Basic realm="Studi-Dashboard"');
  res.status(401).json({ error: 'Nicht angemeldet oder falsche Zugangsdaten' });
}

module.exports = requireAuth;
