<script setup>
import { RouterView, useRoute } from 'vue-router';
import NavBar from './components/NavBar.vue';

const route = useRoute();
</script>

<template>
  <!-- Navigation nur auf Seiten, für die man angemeldet sein muss -->
  <NavBar v-if="route.meta.public !== true" :key="route.fullPath" />
  <!-- Hier zeigt der Router die jeweils aktuelle Seite an -->
  <RouterView />
</template>
