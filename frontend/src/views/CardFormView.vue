<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const router = useRouter();

// Gibt es eine ID in der Adresse, wird eine bestehende Karte bearbeitet
const cardId = route.params.id;
const isEdit = computed(() => Boolean(cardId));

// Formularfelder
const deckId = ref('');
const question = ref('');
const answer = ref('');
const difficulty = ref('mittel');
const status = ref('neu');

// Stapel für die Auswahl und Zustand der Seite
const decks = ref([]);
const error = ref('');
const saving = ref(false);

/**
 * Prüft die Eingaben und speichert die Karte –
 * als neue Karte (POST /cards) oder als Änderung (PUT /cards/:id).
 */
async function save() {
  error.value = '';
  if (!question.value.trim() || !answer.value.trim()) {
    error.value = 'Bitte Frage und Antwort ausfüllen.';
    return;
  }

  const body = {
    deckId: Number(deckId.value),
    question: question.value.trim(),
    answer: answer.value.trim(),
    difficulty: difficulty.value,
    status: status.value
  };

  saving.value = true;
  try {
    if (isEdit.value) {
      await api(`/cards/${cardId}`, { method: 'PUT', body });
    } else {
      await api('/cards', { method: 'POST', body });
    }
    router.push('/cards');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    decks.value = await api('/decks');
    if (isEdit.value) {
      // Bestehende Karte laden und ins Formular übernehmen
      const card = await api(`/cards/${cardId}`);
      deckId.value = card.deckId;
      question.value = card.question;
      answer.value = card.answer;
      difficulty.value = card.difficulty;
      status.value = card.status;
    } else if (decks.value.length > 0) {
      // Neue Karte: ersten Stapel vorauswählen
      deckId.value = decks.value[0].id;
    }
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <main class="page">
    <h1>{{ isEdit ? 'Karte bearbeiten' : 'Neue Karte' }}</h1>

    <p v-if="decks.length === 0 && !error">
      Lege zuerst einen <RouterLink to="/decks">Stapel</RouterLink> an.
    </p>

    <form v-else class="card form" @submit.prevent="save">
      <label>
        Stapel
        <select v-model="deckId" required>
          <option v-for="d in decks" :key="d.id" :value="d.id">{{ d.title }}</option>
        </select>
      </label>
      <label>
        Frage
        <textarea v-model="question" rows="3" required></textarea>
      </label>
      <label>
        Antwort
        <textarea v-model="answer" rows="3" required></textarea>
      </label>
      <div class="inline-form">
        <label>
          Schwierigkeit
          <select v-model="difficulty">
            <option value="leicht">leicht</option>
            <option value="mittel">mittel</option>
            <option value="schwer">schwer</option>
          </select>
        </label>
        <label>
          Status
          <select v-model="status">
            <option value="neu">neu</option>
            <option value="lernend">lernend</option>
            <option value="gelernt">gelernt</option>
          </select>
        </label>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="actions">
        <button type="submit" :disabled="saving">{{ saving ? 'Wird gespeichert …' : 'Speichern' }}</button>
        <RouterLink to="/cards" class="button secondary">Abbrechen</RouterLink>
      </div>
    </form>
  </main>
</template>
