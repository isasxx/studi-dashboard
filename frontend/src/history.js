// Lernverlauf im LocalStorage des Browsers (bleibt auch nach dem Schließen erhalten)
const STORAGE_KEY = 'learnHistory';

/**
 * Liest den gesamten Lernverlauf (Read).
 * @returns {Array<{id: string, date: string, deckId: number, deckTitle: string, right: number, wrong: number}>}
 */
export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Schreibt den Verlauf zurück in den LocalStorage.
 * @param {Array<object>} history
 */
function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Speicher voll oder gesperrt (z. B. privater Modus) – dann eben ohne Verlauf
  }
}

/**
 * Speichert eine Lernsitzung.
 * Gibt es für denselben Stapel heute schon einen Eintrag, wird er ergänzt (Update),
 * sonst wird ein neuer Eintrag angelegt (Create).
 * @param {{deckId: number, deckTitle: string, right: number, wrong: number}} session
 */
export function addSession(session) {
  const history = getHistory();
  const today = new Date().toISOString().slice(0, 10);
  const existing = history.find(h => h.date === today && h.deckId === session.deckId);

  if (existing) {
    existing.right += session.right;
    existing.wrong += session.wrong;
    existing.deckTitle = session.deckTitle;
  } else {
    history.unshift({ id: crypto.randomUUID(), date: today, ...session });
  }
  saveHistory(history);
}

/**
 * Löscht einen einzelnen Eintrag aus dem Verlauf (Delete).
 * @param {string} id
 */
export function deleteSession(id) {
  saveHistory(getHistory().filter(h => h.id !== id));
}
