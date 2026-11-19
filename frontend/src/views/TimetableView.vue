<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';
import { campusLink } from '../campus';

// Höhe einer Stunde im Wochenraster (Pixel)
const HOUR_HEIGHT = 60;

// Alle wie viele Minuten die offene Seite die Daten neu abfragt
const RELOAD_MINUTES = 5;

// Farben für die Module (Hintergrund, Rand)
const COLORS = [
  ['#fde8eb', '#c8102e'],
  ['#e6effb', '#2b6cb0'],
  ['#e3f3e8', '#2f855a'],
  ['#fff1db', '#b7791f'],
  ['#efe9fa', '#6b46c1'],
  ['#e3f4f5', '#2c7a7b']
];

// Abkürzungen der HWR für die Art der Veranstaltung
const TYPE_LABELS = {
  SU: 'Seminaristischer Unterricht',
  V: 'Vorlesung',
  PÜ: 'Praktische Übung',
  Ü: 'Übung'
};

// Daten vom Backend
const timetable = ref(null);
const error = ref('');
const loading = ref(false);

// Kursauswahl
const courses = ref([]);
const choosing = ref(false);
const savingId = ref(null);

// Kurse nach Semester gruppiert, z. B. [{ semester: 1, courses: [Kurs A, Kurs B] }, …]
const coursesBySemester = computed(() => {
  const groups = [];
  for (const course of courses.value) {
    let group = groups.find(g => g.semester === course.semester);
    if (!group) {
      group = { semester: course.semester, courses: [] };
      groups.push(group);
    }
    group.courses.push(course);
  }
  return groups;
});

// Montag der angezeigten Woche
const weekStart = ref(mondayOf(new Date()));

/**
 * Liefert den Montag (00:00 Uhr) der Woche, in der ein Datum liegt.
 * @param {Date} date
 * @returns {Date}
 */
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (d.getDay() + 6) % 7; // Montag = 0 … Sonntag = 6
  d.setDate(d.getDate() - weekday);
  return d;
}

/**
 * Verschiebt ein Datum um eine Anzahl Tage.
 * @param {Date} date
 * @param {number} days
 * @returns {Date} ein neues Datum
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Wandelt ein Datum in den Text JJJJ-MM-TT um (lokale Zeit).
 * @param {Date} date
 * @returns {string}
 */
function isoDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Formatiert eine Uhrzeit, z. B. "09:15".
 * @param {string} iso
 * @returns {string}
 */
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Minuten seit Mitternacht, z. B. 09:15 -> 555.
 * @param {string} iso
 * @returns {number}
 */
function minutesOfDay(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Wählt eine feste Farbe pro Modul, damit dasselbe Modul immer gleich aussieht.
 * @param {{code: string, title: string}} event
 * @returns {{background: string, borderColor: string}}
 */
function colorOf(event) {
  const key = event.code || event.title;
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  const [background, borderColor] = COLORS[hash % COLORS.length];
  return { background, borderColor };
}

/**
 * Ordnet die Termine eines Tages im Raster an.
 * Überschneiden sich Termine, werden sie nebeneinander gesetzt.
 * @param {Array<object>} events - Termine eines Tages
 * @param {number} startHour - erste Stunde des Rasters
 * @returns {Array<object>} Termine mit Positionsangaben (style)
 */
function layoutDay(events, startHour) {
  const sorted = events
    .map(e => ({ ...e, from: minutesOfDay(e.start), to: minutesOfDay(e.end) }))
    .sort((a, b) => a.from - b.from);

  const placed = [];
  let group = [];
  let groupEnd = 0;

  // Eine Gruppe = Termine, die sich (über Ecken) überschneiden
  const placeGroup = () => {
    const lanes = []; // Ende des letzten Termins pro Spalte
    for (const e of group) {
      let lane = lanes.findIndex(end => end <= e.from);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(e.to);
      } else {
        lanes[lane] = e.to;
      }
      e.lane = lane;
    }
    for (const e of group) {
      const width = 100 / lanes.length;
      e.style = {
        top: ((e.from - startHour * 60) / 60) * HOUR_HEIGHT + 'px',
        height: Math.max(((e.to - e.from) / 60) * HOUR_HEIGHT - 3, 22) + 'px',
        left: `calc(${e.lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        ...colorOf(e)
      };
      placed.push(e);
    }
    group = [];
  };

  for (const e of sorted) {
    if (group.length > 0 && e.from >= groupEnd) placeGroup();
    group.push(e);
    groupEnd = Math.max(group.length === 1 ? 0 : groupEnd, e.to);
  }
  if (group.length > 0) placeGroup();
  return placed;
}

// Überschrift der Woche, z. B. "16.11. – 22.11.2026"
const weekLabel = computed(() => {
  const end = addDays(weekStart.value, 6);
  const short = { day: '2-digit', month: '2-digit' };
  return `${weekStart.value.toLocaleDateString('de-DE', short)} – ${end.toLocaleDateString('de-DE')}`;
});

// Termine nach Wochentag gruppiert: Montag bis Freitag immer, Wochenende nur mit Terminen
const days = computed(() => {
  const events = timetable.value?.events || [];
  const result = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart.value, i);
    const key = isoDate(day);
    const dayEvents = events.filter(e => isoDate(new Date(e.start)) === key);
    if (i < 5 || dayEvents.length > 0) {
      result.push({
        key,
        label: day.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }),
        short: day.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        isToday: key === isoDate(new Date()),
        events: dayEvents
      });
    }
  }
  return result;
});

// Stunden, die das Raster zeigt: mindestens 8 bis 18 Uhr, bei Bedarf mehr
const hours = computed(() => {
  const events = timetable.value?.events || [];
  let first = 8;
  let last = 18;
  for (const e of events) {
    first = Math.min(first, Math.floor(minutesOfDay(e.start) / 60));
    last = Math.max(last, Math.ceil(minutesOfDay(e.end) / 60));
  }
  return Array.from({ length: last - first }, (_, i) => first + i);
});

// Termine pro Tag mit Position im Raster
const gridDays = computed(() =>
  days.value.map(day => ({ ...day, placed: layoutDay(day.events, hours.value[0]) }))
);

/**
 * Lädt die Termine der angezeigten Woche (GET /timetable).
 * @param {boolean} [refresh=false] - true = Backend soll sofort neu von der HWR laden
 */
async function load(refresh = false) {
  error.value = '';
  loading.value = true;
  const from = isoDate(weekStart.value);
  const to = isoDate(addDays(weekStart.value, 7));
  try {
    const extra = refresh === true ? '&refresh=true' : '';
    timetable.value = await api(`/timetable?from=${from}&to=${to}${extra}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

/**
 * Wählt einen Kurs aus (PUT /timetable) und lädt danach dessen Stundenplan.
 * @param {string} courseId - z. B. "informatik-3-b"
 */
async function chooseCourse(courseId) {
  error.value = '';
  savingId.value = courseId;
  try {
    await api('/timetable', { method: 'PUT', body: { courseId } });
    choosing.value = false;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    savingId.value = null;
  }
}

/**
 * Blättert eine Woche vor oder zurück.
 * @param {number} direction - -1 = zurück, 1 = vor
 */
function changeWeek(direction) {
  weekStart.value = addDays(weekStart.value, direction * 7);
  load();
}

/**
 * Springt zur aktuellen Woche.
 */
function thisWeek() {
  weekStart.value = mondayOf(new Date());
  load();
}

/**
 * Lädt neu, sobald man zur App zurückkehrt (z. B. nach dem Wechsel in eine andere App).
 */
function onVisibilityChange() {
  if (document.visibilityState === 'visible') load();
}

// Automatisch aktualisieren: regelmäßig und beim Zurückkehren zur Seite
let reloadTimer;
onMounted(async () => {
  // Beim Öffnen bzw. Neuladen der Seite immer frisch von der HWR holen
  load(true);
  try {
    courses.value = await api('/timetable/courses');
  } catch (e) {
    error.value = e.message;
  }
  reloadTimer = setInterval(load, RELOAD_MINUTES * 60 * 1000);
  document.addEventListener('visibilitychange', onVisibilityChange);
});

// Beim Verlassen der Seite aufräumen, sonst laufen Timer und Listener weiter
onUnmounted(() => {
  clearInterval(reloadTimer);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<template>
  <main class="page page-wide">
    <h1>Stundenplan</h1>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <!-- Kursauswahl: beim ersten Mal oder wenn man den Kurs wechseln will -->
    <section v-if="timetable && (!timetable.configured || choosing)" class="card">
      <h2>Kurs wählen</h2>
      <div class="course-picker">
        <div v-for="group in coursesBySemester" :key="group.semester" class="course-row">
          <span class="course-semester">{{ group.semester }}. Semester</span>
          <div class="actions">
            <button
              v-for="course in group.courses"
              :key="course.id"
              type="button"
              :class="{ secondary: timetable.course?.id !== course.id }"
              :disabled="savingId !== null"
              @click="chooseCourse(course.id)"
            >
              {{ savingId === course.id ? 'Lädt …' : `Kurs ${course.group}` }}
            </button>
          </div>
        </div>
      </div>
      <button v-if="timetable.configured" type="button" class="link section" @click="choosing = false">
        Abbrechen
      </button>
    </section>

    <template v-if="timetable?.configured && !choosing">
      <p class="muted course-label">
        {{ timetable.course?.label || 'Eigener Stundenplan' }} ·
        <button type="button" class="link" @click="choosing = true">Kurs wechseln</button>
      </p>

      <div class="row week-nav">
        <button type="button" class="secondary" aria-label="Vorherige Woche" @click="changeWeek(-1)">←</button>
        <div class="week-label">
          <strong>{{ weekLabel }}</strong>
          <button type="button" class="link" @click="thisWeek">Heute</button>
        </div>
        <button type="button" class="secondary" aria-label="Nächste Woche" @click="changeWeek(1)">→</button>
      </div>

      <p v-if="timetable.stale" class="error">
        Die HWR-Seite ist gerade nicht erreichbar – du siehst den zuletzt geladenen Stand.
      </p>

      <!-- Wochenraster (große Bildschirme) -->
      <div class="card tt-grid" :style="{ '--days': gridDays.length }">
        <div class="tt-head">
          <div></div>
          <div v-for="day in gridDays" :key="day.key" class="tt-day-head" :class="{ today: day.isToday }">
            {{ day.short }}
          </div>
        </div>
        <div class="tt-body" :style="{ height: hours.length * HOUR_HEIGHT + 'px' }">
          <div class="tt-times">
            <span v-for="(h, i) in hours" :key="h" :style="{ top: i * HOUR_HEIGHT + 'px' }">
              {{ String(h).padStart(2, '0') }}:00
            </span>
          </div>
          <div
            v-for="day in gridDays"
            :key="day.key"
            class="tt-col"
            :class="{ today: day.isToday }"
            :style="{ backgroundSize: `100% ${HOUR_HEIGHT}px` }"
          >
            <div
              v-for="event in day.placed"
              :key="event.start + event.title"
              class="tt-event"
              :style="event.style"
              :title="`${event.title}\n${formatTime(event.start)} – ${formatTime(event.end)}\n${event.lecturer}\n${event.room}`"
            >
              <strong class="tt-title">{{ event.title }}</strong>
              <span>{{ formatTime(event.start) }} – {{ formatTime(event.end) }}</span>
              <RouterLink v-if="campusLink(event.room)" :to="campusLink(event.room)" class="room-link">{{ event.room }}</RouterLink>
              <span v-else>{{ event.room }}</span>
              <span v-if="event.note" class="tt-note">{{ event.note }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Liste (kleine Bildschirme) -->
      <div class="tt-list">
        <section v-for="day in days" :key="day.key" class="day">
          <h2 class="day-title" :class="{ today: day.isToday }">{{ day.label }}</h2>
          <p v-if="day.events.length === 0" class="muted">Keine Veranstaltungen</p>
          <ul v-else class="list">
            <li
              v-for="event in day.events"
              :key="event.start + event.title"
              class="card lecture"
              :style="{ borderLeftColor: colorOf(event).borderColor }"
            >
              <span class="lecture-time">{{ formatTime(event.start) }} – {{ formatTime(event.end) }}</span>
              <div>
                <strong>{{ event.title }}</strong>
                <div class="muted">
                  {{ event.lecturer }}<template v-if="event.lecturer && event.room"> · </template>
                  <RouterLink v-if="campusLink(event.room)" :to="campusLink(event.room)" class="room-link">{{ event.room }}</RouterLink>
                  <template v-else>{{ event.room }}</template>
                </div>
                <div class="tags">
                  <span v-if="event.type" class="tag" :title="TYPE_LABELS[event.type] || ''">{{ event.type }}</span>
                  <span v-if="event.code" class="tag">{{ event.code }}</span>
                  <span v-if="event.note" class="tag status-geplant">{{ event.note }}</span>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <p class="muted section">
        Stand: {{ new Date(timetable.fetchedAt).toLocaleString('de-DE') }} ·
        <button type="button" class="link" :disabled="loading" @click="load(true)">
          {{ loading ? 'Lädt …' : 'Jetzt aktualisieren' }}
        </button>
      </p>
    </template>
  </main>
</template>
