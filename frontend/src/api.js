// Schlüssel, unter dem die Zugangsdaten im Browser gespeichert werden
const STORAGE_KEY = 'auth';

/**
 * Liest die gespeicherten Zugangsdaten.
 * @returns {{email: string, password: string, name: string} | null}
 */
export function getAuth() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Speichert die Zugangsdaten für die aktuelle Sitzung (bis der Tab geschlossen wird).
 * @param {{email: string, password: string, name: string}} auth
 */
export function setAuth(auth) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

/**
 * Löscht die Zugangsdaten (Abmelden).
 */
export function clearAuth() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Wandelt Text in Base64 um – auch mit Umlauten.
 * @param {string} text
 * @returns {string}
 */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Schickt eine Anfrage an das Backend und gibt die JSON-Antwort zurück.
 * Hängt automatisch die Zugangsdaten (Basic Auth) an, wenn jemand angemeldet ist.
 * @param {string} path - z. B. '/decks'
 * @param {{method?: string, body?: object}} [options]
 * @returns {Promise<any>} die Antwort des Servers, oder null bei 204
 * @throws {Error} mit der Fehlermeldung des Servers, wenn der Status kein Erfolg ist
 */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const auth = getAuth();
  if (auth) {
    headers.Authorization = 'Basic ' + toBase64(`${auth.email}:${auth.password}`);
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status === 204) {
    return null;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `Fehler ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
