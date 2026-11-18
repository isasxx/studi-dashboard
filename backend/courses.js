// Adresse, unter der die HWR (Fachbereich 2) die Stundenpläne als ICS-Datei anbietet
const BASE_URL =
  process.env.TIMETABLE_BASE_URL ||
  'https://moodle.hwr-berlin.de/fb2-stundenplan/download.php?doctype=.ics&url=./fb2-stundenplaene';

// Welche Semester und Kurse es gibt – bei Bedarf hier anpassen
const SEMESTERS = [1, 2, 3, 4, 5, 6];
const GROUPS = ['a', 'b'];

/**
 * Alle auswählbaren Kurse mit dem Link zu ihrem Stundenplan.
 * Beispiel: { id: 'informatik-3-b', semester: 3, group: 'B',
 *             label: 'Informatik · 3. Semester · Kurs B', url: '…/informatik/semester3/kursb' }
 */
module.exports = SEMESTERS.flatMap(semester =>
  GROUPS.map(group => ({
    id: `informatik-${semester}-${group}`,
    program: 'Informatik',
    semester,
    group: group.toUpperCase(),
    label: `Informatik · ${semester}. Semester · Kurs ${group.toUpperCase()}`,
    url: `${BASE_URL}/informatik/semester${semester}/kurs${group}`
  }))
);
