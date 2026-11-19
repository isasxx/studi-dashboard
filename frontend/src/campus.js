// Gebäude der HWR am Campus Lichtenberg (Alt-Friedrichsfelde 60).
// Nachgezeichnet nach dem offiziellen Lageplan, gedreht so, dass die Straße oben waagerecht liegt.
// points = Umriss als SVG-Polygon, label = Position der Hausnummer
export const BUILDINGS = [
  {
    id: '1',
    points: '113,170 230,170 230,135 330,135 330,170 497,170 497,212 330,212 330,250 230,250 230,212 113,212',
    label: [280, 192]
  },
  { id: '6A', points: '199,262 382,262 382,352 199,352', label: [290, 307] },
  {
    id: '6B',
    points: '203,368 380,368 380,468 320,468 320,432 262,432 262,468 203,468',
    label: [291, 400]
  },
  { id: '6C', points: '191,482 260,482 260,568 191,568', label: [225, 525] },
  { id: '5', points: '30,612 101,612 101,681 30,681', label: [65, 646] },
  { id: '14', points: '691,105 744,105 744,186 691,186', label: [717, 145] }
];

// Gänge zwischen den Häusern 1, 6A, 6B und 6C
export const CONNECTORS = [
  '283,250 297,250 297,262 283,262',
  '283,352 297,352 297,368 283,368',
  '215,468 229,468 229,482 215,482'
];

// Andere Gebäude auf dem Gelände (nicht HWR) – nur zur Orientierung
export const OTHER_BUILDINGS = [
  '70,140 105,140 150,600 115,600',
  '497,176 668,186 668,216 497,206',
  '400,290 790,290 790,330 610,330 610,450 560,450 560,330 400,330'
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
