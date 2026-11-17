<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { api } from '../api';
import { addSession } from '../history';

const route = useRoute();
const deckId = Number(route.params.deckId);

// Daten der Lernsitzung
const deck = ref(null);
const cards = ref([]);
const index = ref(0);
const flipped = ref(false);
const right = ref(0);
const wrong = ref(0);
const error = ref('');
const loading = ref(true);

// Die Karte, die gerade dran ist (oder undefined, wenn alle durch sind)
const current = computed(() => cards.value[index.value]);
const finished = computed(() => !loading.value && index.value >= cards.value.length);

/**
 * Mischt eine Liste zufällig (Fisher-Yates).
 * @param {Array} list
 * @returns {Array} dieselbe Liste, gemischt
 */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Bewertet die aktuelle Karte, speichert den neuen Lernstatus (PUT /cards/:id)
 * und geht zur nächsten Karte.
 * @param {boolean} known - true = gewusst, false = nicht gewusst
 */
async function answer(known) {
  const card = current.value;
  const status = known ? 'gelernt' : 'lernend';
  if (known) right.value++;
  else wrong.value++;

  try {
    await api(`/cards/${card.id}`, { method: 'PUT', body: { ...card, status } });
  } catch (e) {
    error.value = e.message;
  }

  flipped.value = false;
  index.value++;

  // Letzte Karte geschafft: Sitzung im Lernverlauf speichern
  if (index.value >= cards.value.length) {
    addSession({ deckId, deckTitle: deck.value?.title || '', right: right.value, wrong: wrong.value });
  }
}

/**
 * Startet die Lernsitzung von vorn, mit neu gemischten Karten.
 */
function restart() {
  shuffle(cards.value);
  index.value = 0;
  right.value = 0;
  wrong.value = 0;
  flipped.value = false;
}

onMounted(async () => {
  try {
    const decks = await api('/decks');
    deck.value = decks.find(d => d.id === deckId) || null;
    const result = await api(`/cards?deck=${deckId}&size=100`);
    cards.value = shuffle(result.data);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="page">
    <h1>Lernen: {{ deck?.title }}</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p v-if="loading">Lade Karten …</p>

    <p v-else-if="cards.length === 0">
      Dieser Stapel hat noch keine Karten. <RouterLink to="/cards/new">Karte anlegen</RouterLink>
    </p>

    <!-- Fertig: Auswertung -->
    <section v-else-if="finished" class="card result">
      <h2>Geschafft! 🎉</h2>
      <p>{{ right }} gewusst · {{ wrong }} nicht gewusst</p>
      <div class="actions">
        <button type="button" @click="restart">Nochmal lernen</button>
        <RouterLink to="/" class="button secondary">Zur Übersicht</RouterLink>
      </div>
    </section>

    <!-- Lernen: Karte zum Umdrehen -->
    <section v-else>
      <p class="muted">Karte {{ index + 1 }} von {{ cards.length }}</p>

      <button
        type="button"
        class="flashcard"
        :class="{ flipped }"
        :aria-label="flipped ? 'Antwort, zum Umdrehen tippen' : 'Frage, zum Umdrehen tippen'"
        @click="flipped = !flipped"
      >
        <span class="flashcard-inner">
          <span class="flashcard-face front">
            <span class="face-label">Frage</span>
            {{ current.question }}
          </span>
          <span class="flashcard-face back">
            <span class="face-label">Antwort</span>
            {{ current.answer }}
          </span>
        </span>
      </button>

      <div v-if="flipped" class="actions center">
        <button type="button" class="secondary" @click="answer(false)">Nicht gewusst</button>
        <button type="button" @click="answer(true)">Gewusst</button>
      </div>
      <p v-else class="muted center-text">Tippe auf die Karte, um die Antwort zu sehen.</p>
    </section>
  </main>
</template>
