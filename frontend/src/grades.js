// Gültige Noten nach deutschem System (wie im Backend)
export const VALID_GRADES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0];

/**
 * Formatiert eine Note deutsch mit Komma, z. B. 2.3 -> "2,3".
 * @param {number|null} grade
 * @returns {string} die formatierte Note, oder "–" wenn es keine gibt
 */
export function formatGrade(grade) {
  if (grade === null || grade === undefined) return '–';
  return grade.toFixed(grade * 10 % 1 === 0 ? 1 : 2).replace('.', ',');
}
