<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api, getAuth } from '../api';
import { getHistory, deleteSession } from '../history';

const user = getAuth();

// Daten der Seite
const decks = ref([]);
const history = ref(getHistory());
const error = ref('');

/**
 * Löscht einen Eintrag aus dem Lernverlauf und aktualisiert die Anzeige.
 * @param {string} id
 */
function removeSession(id) {
  deleteSession(id);
  history.value = getHistory();
}

/**
 * Formatiert ein Datum (JJJJ-MM-TT) deutsch (TT.MM.JJJJ).
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Beim Öffnen der Seite die Stapel vom Backend laden
onMounted(async () => {
  try {
    decks.value = await api('/decks');
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <main class="page">
    <h1>Hallo, {{ user?.name }}!</h1>

    <h2>Deine Stapel</h2>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="decks.length === 0">
      Noch keine Stapel. <RouterLink to="/decks">Ersten Stapel anlegen</RouterLink>
    </p>
    <ul v-else class="list">
      <li v-for="deck in decks" :key="deck.id" class="card row">
        <strong>{{ deck.title }}</strong>
        <RouterLink :to="`/learn/${deck.id}`" class="button">Lernen</RouterLink>
      </li>
    </ul>

    <h2 class="section">Lernverlauf</h2>
    <p v-if="history.length === 0" class="muted">Noch keine Lernsitzungen.</p>
    <ul v-else class="list">
      <li v-for="h in history" :key="h.id" class="card row">
        <div>
          <strong>{{ h.deckTitle }}</strong>
          <div class="muted">{{ formatDate(h.date) }} · {{ h.right }} gewusst · {{ h.wrong }} nicht gewusst</div>
        </div>
        <button type="button" class="secondary" @click="removeSession(h.id)">Entfernen</button>
      </li>
    </ul>
  </main>
</template>
