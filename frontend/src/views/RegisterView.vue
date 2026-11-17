<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { api, setAuth } from '../api';

const router = useRouter();

// Formularfelder und Zustand der Seite
const name = ref('');
const email = ref('');
const password = ref('');
const passwordRepeat = ref('');
const error = ref('');
const loading = ref(false);

/**
 * Prüft die Eingaben, legt das Konto an und meldet die Person direkt an.
 */
async function submit() {
  error.value = '';
  if (password.value.length < 8) {
    error.value = 'Das Passwort muss mindestens 8 Zeichen haben.';
    return;
  }
  if (password.value !== passwordRepeat.value) {
    error.value = 'Die Passwörter stimmen nicht überein.';
    return;
  }

  loading.value = true;
  try {
    const user = await api('/auth/register', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value }
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
      <h1>Konto anlegen</h1>
      <label>
        Name
        <input v-model="name" type="text" required autocomplete="name">
      </label>
      <label>
        E-Mail
        <input v-model="email" type="email" required autocomplete="email">
      </label>
      <label>
        Passwort
        <input v-model="password" type="password" required minlength="8" autocomplete="new-password">
      </label>
      <label>
        Passwort wiederholen
        <input v-model="passwordRepeat" type="password" required autocomplete="new-password">
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Wird angelegt …' : 'Registrieren' }}
      </button>
      <p class="hint">
        Schon ein Konto? <RouterLink to="/login">Anmelden</RouterLink>
      </p>
    </form>
  </main>
</template>
