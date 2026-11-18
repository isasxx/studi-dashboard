<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';
import { formatGrade } from '../grades';

// Daten vom Backend
const grades = ref([]);
const summary = ref(null);
const semesters = ref([]);
const error = ref('');

// Filter
const semester = ref('');
const status = ref('');

// Löschen: welche Note auf "Wirklich löschen?" wartet
const confirmDeleteId = ref(null);

// Fortschrittsbalken in Prozent
const progressPercent = computed(() => Math.round((summary.value?.progress || 0) * 100));

/**
 * Lädt die Noten mit den aktuellen Filtern (GET /grades) und die Auswertung (GET /grades/summary).
 */
async function load() {
  error.value = '';
  const params = new URLSearchParams();
  if (semester.value) params.set('semester', semester.value);
  if (status.value) params.set('status', status.value);

  try {
    grades.value = await api(`/grades?${params}`);
    summary.value = await api('/grades/summary');
  } catch (e) {
    error.value = e.message;
  }
}

/**
 * Löscht eine Note (DELETE /grades/:id) und lädt alles neu.
 * @param {number} id
 */
async function deleteGrade(id) {
  try {
    await api(`/grades/${id}`, { method: 'DELETE' });
    confirmDeleteId.value = null;
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

watch([semester, status], load);

onMounted(async () => {
  try {
    // Semester für den Filter aus dem Modulkatalog ableiten (GET /modules)
    const modules = await api('/modules');
    semesters.value = [...new Set(modules.map(m => m.semester))].sort((a, b) => a - b);
  } catch (e) {
    error.value = e.message;
  }
  await load();
});
</script>

<template>
  <main class="page">
    <div class="row">
      <h1>Noten</h1>
      <div class="actions">
        <RouterLink to="/grades/goal" class="button secondary">Zielschnitt</RouterLink>
        <RouterLink to="/grades/new" class="button">Note eintragen</RouterLink>
      </div>
    </div>

    <!-- Auswertung -->
    <section v-if="summary" class="stats">
      <div class="card stat">
        <span class="muted">Notenschnitt</span>
        <strong class="stat-value">{{ formatGrade(summary.average) }}</strong>
      </div>
      <div class="card stat">
        <span class="muted">ECTS</span>
        <strong class="stat-value">{{ summary.ectsDone }} / {{ summary.ectsTotal }}</strong>
        <div class="progress" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
    </section>

    <div class="card inline-form">
      <label>
        Semester
        <select v-model="semester">
          <option value="">Alle</option>
          <option v-for="s in semesters" :key="s" :value="s">{{ s }}. Semester</option>
        </select>
      </label>
      <label>
        Status
        <select v-model="status">
          <option value="">Alle</option>
          <option value="bestanden">bestanden</option>
          <option value="nicht bestanden">nicht bestanden</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p v-if="grades.length === 0">Keine Noten gefunden.</p>
    <div v-else class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Modul</th>
            <th>Sem.</th>
            <th>ECTS</th>
            <th>Note</th>
            <th>Status</th>
            <th>Versuch</th>
            <th><span class="visually-hidden">Aktionen</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in grades" :key="g.id">
            <td>{{ g.moduleName }}</td>
            <td>{{ g.semester }}</td>
            <td>{{ g.ects }}</td>
            <td>
              <strong v-if="g.graded">{{ formatGrade(g.grade) }}</strong>
              <span v-else class="muted">unbenotet</span>
            </td>
            <td><span class="tag" :class="'status-' + g.status.replace(' ', '-')">{{ g.status }}</span></td>
            <td>{{ g.attempt }}</td>
            <td>
              <div class="actions">
                <template v-if="confirmDeleteId === g.id">
                  <button type="button" @click="deleteGrade(g.id)">Ja, löschen</button>
                  <button type="button" class="secondary" @click="confirmDeleteId = null">Nein</button>
                </template>
                <template v-else>
                  <RouterLink :to="`/grades/${g.id}/edit`" class="button secondary">Bearbeiten</RouterLink>
                  <button type="button" class="secondary" @click="confirmDeleteId = g.id">Löschen</button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
