<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, getAuth, clearAuth } from '../api';

const router = useRouter();
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

/**
 * Meldet die Person ab und geht zur Login-Seite.
 */
function logout() {
  clearAuth();
  router.push('/login');
}
</script>

<template>
  <main class="page">
    <header class="topbar">
      <h1>Hallo, {{ user?.name }}!</h1>
      <button class="secondary" @click="logout">Abmelden</button>
    </header>

    <h2>Deine Stapel</h2>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="decks.length === 0">Noch keine Stapel.</p>
    <ul v-else class="list">
      <li v-for="deck in decks" :key="deck.id" class="card">
        {{ deck.title }}
      </li>
    </ul>
  </main>
</template>
