// Gebäude der HWR am Campus Lichtenberg (Alt-Friedrichsfelde 60).
// label = Position der Beschriftung auf dem Lageplan-Bild (public/campus-plan.jpg, 2220 × 1372 Pixel)
// info = was im Haus ist. Quellen: hwr-berlin.de (Mensen und Cafeterien, Bibliothek, Infothek)
export const PLAN_WIDTH = 2220;
export const PLAN_HEIGHT = 1372;

export const BUILDINGS = [
  { id: '1', label: [800, 572], info: ['Mensa (Erdgeschoss)', 'Cafeteria (1. Obergeschoss)'] },
  { id: '6A', label: [665, 782], info: ['Infothek (Raum 0.23)'] },
  { id: '6B', label: [625, 890], info: ['Bibliothek (Raum 171)'] },
  { id: '6C', label: [433, 1050], info: [] },
  { id: '5', label: [100, 1120], info: [] },
  { id: '14', label: [1475, 825], info: [] }
];

/**
 * Liest das Haus aus einer Raumangabe, z. B. "6B.450 (T)" -> "6B" oder "5.0002" -> "5".
 * @param {string} room
 * @returns {string|null} die Hausnummer, oder null wenn es kein bekanntes Haus ist
 */
export function buildingFromRoom(room) {
  const match = String(room || '').trim().match(/^(\d+[A-Za-z]?)\./);
  if (!match) return null;
  const id = match[1].toUpperCase();
  return BUILDINGS.some(b => b.id === id) ? id : null;
}

/**
 * Link zum Campusplan für einen Raum, oder null wenn das Haus unbekannt ist.
 * @param {string} room
 * @returns {string|null}
 */
export function campusLink(room) {
  return buildingFromRoom(room) ? `/campus?raum=${encodeURIComponent(room)}` : null;
}
