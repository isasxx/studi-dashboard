<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { api, setAuth } from '../api';

const router = useRouter();

// Formularfelder und Zustand der Seite
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

/**
 * Meldet die Person an und leitet bei Erfolg zum Dashboard weiter.
 */
async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const user = await api('/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    });
    setAuth({ email: email.value, password: password.value, name: user.name });
    router.push('/');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth">
    <form class="card" @submit.prevent="submit">
      <h1>Anmelden</h1>
      <label>
        E-Mail
        <input v-model="email" type="email" required autocomplete="email">
      </label>
      <label>
        Passwort
        <input v-model="password" type="password" required autocomplete="current-password">
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Wird geprüft …' : 'Anmelden' }}
      </button>
      <p class="hint">
        Noch kein Konto? <RouterLink to="/register">Registrieren</RouterLink>
      </p>
    </form>
  </main>
</template>
