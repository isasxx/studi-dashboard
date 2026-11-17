<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api, getAuth } from '../api';

const user = getAuth();

// Daten der Seite
const decks = ref([]);
const error = ref('');

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
      <li v-for="deck in decks" :key="deck.id" class="card">
        {{ deck.title }}
      </li>
    </ul>
  </main>
</template>
