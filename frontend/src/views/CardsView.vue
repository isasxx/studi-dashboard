<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';

// Wie viele Karten pro Seite angezeigt werden
const PAGE_SIZE = 5;

// Daten vom Backend
const decks = ref([]);
const cards = ref([]);
const total = ref(0);
const error = ref('');

// Filter und aktuelle Seite
const deck = ref('');
const difficulty = ref('');
const status = ref('');
const search = ref('');
const page = ref(1);

// Löschen: welche Karte auf "Wirklich löschen?" wartet
const confirmDeleteId = ref(null);

// Anzahl der Seiten, mindestens 1
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

/**
 * Sucht den Titel eines Stapels anhand seiner ID.
 * @param {number} id
 * @returns {string}
 */
function deckTitle(id) {
  return decks.value.find(d => d.id === id)?.title || '';
}

/**
 * Lädt die Karten mit den aktuellen Filtern und der aktuellen Seite (GET /cards).
 */
async function loadCards() {
  error.value = '';
  const params = new URLSearchParams({ page: page.value, size: PAGE_SIZE });
  if (deck.value) params.set('deck', deck.value);
  if (difficulty.value) params.set('difficulty', difficulty.value);
  if (status.value) params.set('status', status.value);
  if (search.value) params.set('q', search.value);

  try {
    const result = await api(`/cards?${params}`);
    cards.value = result.data;
    total.value = result.total;
  } catch (e) {
    error.value = e.message;
  }
}

/**
 * Löscht eine Karte (DELETE /cards/:id) und lädt die Liste neu.
 * @param {number} id
 */
async function deleteCard(id) {
  try {
    await api(`/cards/${id}`, { method: 'DELETE' });
    confirmDeleteId.value = null;
    // War es die letzte Karte auf der Seite, eine Seite zurückgehen
    if (cards.value.length === 1 && page.value > 1) {
      page.value--;
    } else {
      await loadCards();
    }
  } catch (e) {
    error.value = e.message;
  }
}

// Ändert sich ein Filter, wieder bei Seite 1 anfangen
watch([deck, difficulty, status], () => {
  if (page.value === 1) loadCards();
  else page.value = 1;
});

// Bei der Suche kurz warten, bis man fertig getippt hat
let searchTimer;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (page.value === 1) loadCards();
    else page.value = 1;
  }, 300);
});

// Seitenwechsel lädt die passende Seite
watch(page, loadCards);

onMounted(async () => {
  try {
    decks.value = await api('/decks');
  } catch (e) {
    error.value = e.message;
  }
  await loadCards();
});
</script>

<template>
  <main class="page">
    <div class="row">
      <h1>Karten</h1>
      <RouterLink to="/cards/new" class="button">Neue Karte</RouterLink>
    </div>

    <div class="card inline-form">
      <label>
        Stapel
        <select v-model="deck">
          <option value="">Alle</option>
          <option v-for="d in decks" :key="d.id" :value="d.id">{{ d.title }}</option>
        </select>
      </label>
      <label>
        Schwierigkeit
        <select v-model="difficulty">
          <option value="">Alle</option>
          <option value="leicht">leicht</option>
          <option value="mittel">mittel</option>
          <option value="schwer">schwer</option>
        </select>
      </label>
      <label>
        Status
        <select v-model="status">
          <option value="">Alle</option>
          <option value="neu">neu</option>
          <option value="lernend">lernend</option>
          <option value="gelernt">gelernt</option>
        </select>
      </label>
      <label>
        Suche
        <input v-model="search" type="search" placeholder="Frage oder Antwort">
      </label>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p v-if="cards.length === 0">Keine Karten gefunden.</p>
    <ul v-else class="list">
      <li v-for="card in cards" :key="card.id" class="card">
        <div class="row">
          <div>
            <strong>{{ card.question }}</strong>
            <div class="muted">{{ card.answer }}</div>
            <div class="tags">
              <span class="tag">{{ deckTitle(card.deckId) }}</span>
              <span class="tag">{{ card.difficulty }}</span>
              <span class="tag">{{ card.status }}</span>
            </div>
          </div>
          <div class="actions">
            <template v-if="confirmDeleteId === card.id">
              <span class="muted">Wirklich löschen?</span>
              <button type="button" @click="deleteCard(card.id)">Ja, löschen</button>
              <button type="button" class="secondary" @click="confirmDeleteId = null">Nein</button>
            </template>
            <template v-else>
              <RouterLink :to="`/cards/${card.id}/edit`" class="button secondary">Bearbeiten</RouterLink>
              <button type="button" class="secondary" @click="confirmDeleteId = card.id">Löschen</button>
            </template>
          </div>
        </div>
      </li>
    </ul>

    <div class="pagination">
      <button type="button" class="secondary" :disabled="page <= 1" @click="page--">Zurück</button>
      <span class="muted">Seite {{ page }} von {{ pageCount }} · {{ total }} Karten</span>
      <button type="button" class="secondary" :disabled="page >= pageCount" @click="page++">Weiter</button>
    </div>
  </main>
</template>
