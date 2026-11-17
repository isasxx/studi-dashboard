<script setup>
import { useRouter, RouterLink } from 'vue-router';
import { getAuth, clearAuth } from '../api';

const router = useRouter();
const user = getAuth();

/**
 * Meldet die Person ab und geht zur Login-Seite.
 */
function logout() {
  clearAuth();
  router.push('/login');
}
</script>

<template>
  <nav class="nav">
    <RouterLink to="/" class="brand">Studi-Dashboard</RouterLink>
    <div class="nav-links">
      <RouterLink to="/">Übersicht</RouterLink>
      <RouterLink to="/decks">Stapel</RouterLink>
    </div>
    <div class="nav-user">
      <span>{{ user?.name }}</span>
      <button class="secondary" @click="logout">Abmelden</button>
    </div>
  </nav>
</template>
