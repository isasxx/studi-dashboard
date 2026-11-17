<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api';

// Liste der Stapel und Fehlermeldung
const decks = ref([]);
const error = ref('');

// Formular "Neuer Stapel"
const newTitle = ref('');
const newModule = ref('');

// Bearbeiten: welcher Stapel gerade bearbeitet wird und die Werte im Formular
const editingId = ref(null);
const editTitle = ref('');
const editModule = ref('');

// Löschen: welcher Stapel auf "Wirklich löschen?" wartet
const confirmDeleteId = ref(null);

/**
 * Lädt alle Stapel vom Backend.
 */
async function loadDecks() {
  try {
    decks.value = await api('/decks');
  } catch (e) {
    error.value = e.message;
  }
}

/**
 * Legt einen neuen Stapel an (POST /decks) und leert danach das Formular.
 */
async function createDeck() {
  error.value = '';
  try {
    await api('/decks', {
      method: 'POST',
      body: { title: newTitle.value, module: newModule.value }
    });
    newTitle.value = '';
    newModule.value = '';
    await loadDecks();
  } catch (e) {
    error.value = e.message;
  }
}

/**
 * Öffnet den Bearbeiten-Modus für einen Stapel.
 * @param {{id: number, title: string, module: string|null}} deck
 */
function startEdit(deck) {
  editingId.value = deck.id;
  editTitle.value = deck.title;
  editModule.value = deck.module || '';
}

/**
 * Speichert die Änderungen an einem Stapel (PUT /decks/:id).
 */
async function saveEdit() {
  error.value = '';
  try {
    await api(`/decks/${editingId.value}`, {
      method: 'PUT',
      body: { title: editTitle.value, module: editModule.value }
    });
    editingId.value = null;
    await loadDecks();
  } catch (e) {
    error.value = e.message;
  }
}

/**
 * Löscht einen Stapel samt Karten (DELETE /decks/:id).
 * @param {number} id
 */
async function deleteDeck(id) {
  error.value = '';
  try {
    await api(`/decks/${id}`, { method: 'DELETE' });
    confirmDeleteId.value = null;
    await loadDecks();
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(loadDecks);
</script>

<template>
  <main class="page">
    <h1>Stapel</h1>

    <form class="card inline-form" @submit.prevent="createDeck">
      <label>
        Titel
        <input v-model="newTitle" type="text" required placeholder="z. B. Statistik">
      </label>
      <label>
        Modul
        <input v-model="newModule" type="text" placeholder="optional">
      </label>
      <button type="submit">Anlegen</button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <p v-if="decks.length === 0">Noch keine Stapel.</p>
    <ul v-else class="list">
      <li v-for="deck in decks" :key="deck.id" class="card">
        <!-- Bearbeiten-Modus -->
        <form v-if="editingId === deck.id" class="inline-form" @submit.prevent="saveEdit">
          <label>
            Titel
            <input v-model="editTitle" type="text" required>
          </label>
          <label>
            Modul
            <input v-model="editModule" type="text">
          </label>
          <button type="submit">Speichern</button>
          <button type="button" class="secondary" @click="editingId = null">Abbrechen</button>
        </form>

        <!-- Normale Anzeige -->
        <div v-else class="row">
          <div>
            <strong>{{ deck.title }}</strong>
            <div v-if="deck.module" class="muted">{{ deck.module }}</div>
          </div>
          <div class="actions">
            <template v-if="confirmDeleteId === deck.id">
              <span class="muted">Wirklich löschen?</span>
              <button type="button" @click="deleteDeck(deck.id)">Ja, löschen</button>
              <button type="button" class="secondary" @click="confirmDeleteId = null">Nein</button>
            </template>
            <template v-else>
              <RouterLink :to="`/learn/${deck.id}`" class="button">Lernen</RouterLink>
              <button type="button" class="secondary" @click="startEdit(deck)">Bearbeiten</button>
              <button type="button" class="secondary" @click="confirmDeleteId = deck.id">Löschen</button>
            </template>
          </div>
        </div>
      </li>
    </ul>
  </main>
</template>
