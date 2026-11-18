<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';
import { formatGrade } from '../grades';

// Eingabe und Ergebnis
const target = ref(2.0);
const result = ref(null);
const openModules = ref([]);
const error = ref('');

/**
 * Fragt beim Backend nach, welche Durchschnittsnote für den Zielschnitt nötig ist
 * (GET /grades/summary?target=…).
 */
async function calculate() {
  error.value = '';
  try {
    const summary = await api(`/grades/summary?target=${target.value}`);
    result.value = summary;
  } catch (e) {
    error.value = e.message;
  }
}

// Verständlicher Satz zum Ergebnis
const message = computed(() => {
  const goal = result.value?.goal;
  if (!goal) return '';
  if (goal.required === null) {
    return goal.reachable
      ? 'Alle Module sind bestanden – dein Zielschnitt ist erreicht.'
      : 'Alle Module sind bestanden – der Zielschnitt ist nicht mehr erreichbar.';
  }
  if (!goal.reachable) {
    return `Leider nicht mehr erreichbar: Du bräuchtest im Schnitt ${formatGrade(goal.required)} – besser als 1,0 geht nicht.`;
  }
  if (goal.required > 4.0) {
    return 'Das schaffst du sicher: Selbst mit lauter 4,0 erreichst du deinen Zielschnitt.';
  }
  return `Du brauchst in den offenen Modulen im Schnitt eine ${formatGrade(goal.required)}.`;
});

onMounted(async () => {
  try {
    // Offene Module = alle Module ohne bestandene Note (GET /modules, GET /grades)
    const modules = await api('/modules');
    const passed = await api('/grades?status=bestanden');
    const passedIds = new Set(passed.map(g => g.moduleId));
    openModules.value = modules.filter(m => !passedIds.has(m.id));
  } catch (e) {
    error.value = e.message;
  }
  await calculate();
});
</script>

<template>
  <main class="page">
    <h1>Zielschnitt-Rechner</h1>

    <form class="card inline-form" @submit.prevent="calculate">
      <label>
        Mein Zielschnitt
        <input v-model="target" type="number" min="1" max="4" step="0.1" required>
      </label>
      <button type="submit">Berechnen</button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <section v-if="result?.goal" class="card goal">
      <p class="goal-message">{{ message }}</p>
      <p class="muted">
        Aktueller Schnitt: {{ formatGrade(result.average) }} ·
        {{ result.ectsDone }} von {{ result.ectsTotal }} ECTS geschafft
      </p>
    </section>

    <h2 class="section">Offene Module ({{ openModules.length }})</h2>
    <p v-if="openModules.length === 0" class="muted">Keine offenen Module.</p>
    <ul v-else class="list">
      <li v-for="m in openModules" :key="m.id" class="card row">
        <span>{{ m.semester }}. Sem. · <strong>{{ m.name }}</strong></span>
        <span class="muted">{{ m.ects }} ECTS</span>
      </li>
    </ul>

    <p class="section">
      <RouterLink to="/grades">← Zurück zu den Noten</RouterLink>
    </p>
  </main>
</template>
