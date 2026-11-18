<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '../api';
import { VALID_GRADES, formatGrade } from '../grades';

const route = useRoute();
const router = useRouter();

// Gibt es eine ID in der Adresse, wird eine bestehende Note bearbeitet
const gradeId = Number(route.params.id) || null;
const isEdit = computed(() => gradeId !== null);

// Formularfelder.
// result ist entweder eine Note als Text ("1.3") oder "pass"/"fail" für unbenotete Module.
const moduleId = ref('');
const result = ref('2');
const attempt = ref(1);
const date = ref('');

// Modulkatalog für die Auswahl und Zustand der Seite
const modules = ref([]);
const error = ref('');
const saving = ref(false);

/**
 * Wandelt die Auswahl im Feld "Ergebnis" in die Daten für das Backend um.
 * @param {string} value - "pass", "fail" oder eine Note wie "1.3"
 * @returns {{grade: number|null, passed?: boolean}}
 */
function toGradeData(value) {
  if (value === 'pass') return { grade: null, passed: true };
  if (value === 'fail') return { grade: null, passed: false };
  return { grade: Number(value) };
}

/**
 * Speichert die Note – als neue Note (POST /grades) oder als Änderung (PUT /grades/:id).
 */
async function save() {
  error.value = '';
  if (!moduleId.value) {
    error.value = 'Bitte ein Modul auswählen.';
    return;
  }

  const body = {
    moduleId: Number(moduleId.value),
    ...toGradeData(result.value),
    attempt: Number(attempt.value),
    date: date.value || null
  };

  saving.value = true;
  try {
    if (isEdit.value) {
      await api(`/grades/${gradeId}`, { method: 'PUT', body });
    } else {
      await api('/grades', { method: 'POST', body });
    }
    router.push('/grades');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    modules.value = await api('/modules');
    if (isEdit.value) {
      // Bestehende Note aus der Liste holen und ins Formular übernehmen
      const all = await api('/grades');
      const existing = all.find(g => g.id === gradeId);
      if (!existing) {
        error.value = 'Note nicht gefunden';
        return;
      }
      moduleId.value = existing.moduleId;
      if (existing.graded) {
        result.value = String(existing.grade);
      } else {
        result.value = existing.passed ? 'pass' : 'fail';
      }
      attempt.value = existing.attempt;
      date.value = existing.date || '';
    }
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <main class="page">
    <h1>{{ isEdit ? 'Note bearbeiten' : 'Note eintragen' }}</h1>

    <form class="card form" @submit.prevent="save">
      <label>
        Modul
        <select v-model="moduleId" required>
          <option value="" disabled>Bitte wählen</option>
          <option v-for="m in modules" :key="m.id" :value="m.id">
            {{ m.semester }}. Sem. · {{ m.name }} ({{ m.ects }} ECTS)
          </option>
        </select>
      </label>
      <div class="inline-form">
        <label>
          Ergebnis
          <select v-model="result">
            <optgroup label="Benotet">
              <option v-for="g in VALID_GRADES" :key="g" :value="String(g)">{{ formatGrade(g) }}</option>
            </optgroup>
            <optgroup label="Unbenotet">
              <option value="pass">bestanden (unbenotet)</option>
              <option value="fail">nicht bestanden (unbenotet)</option>
            </optgroup>
          </select>
        </label>
        <label>
          Versuch
          <select v-model="attempt">
            <option :value="1">1. Versuch</option>
            <option :value="2">2. Versuch</option>
            <option :value="3">3. Versuch</option>
          </select>
        </label>
        <label>
          Datum
          <input v-model="date" type="date">
        </label>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? 'Wird gespeichert …' : 'Speichern' }}</button>
        <RouterLink to="/grades" class="button secondary">Abbrechen</RouterLink>
      </div>
    </form>
  </main>
</template>
