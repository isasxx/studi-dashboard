<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BUILDINGS, CONNECTORS, OTHER_BUILDINGS, buildingFromRoom } from '../campus';

const route = useRoute();
const router = useRouter();

// Raum aus der Adresse, z. B. /campus?raum=6B.450%20(T)
const room = computed(() => route.query.raum || '');

// Ausgewähltes Haus: direkt (?haus=6B) oder aus dem Raum abgeleitet
const selected = computed(() => {
  const haus = String(route.query.haus || '').toUpperCase();
  if (BUILDINGS.some(b => b.id === haus)) return haus;
  return buildingFromRoom(room.value);
});

/**
 * Wählt ein Haus aus (oder hebt die Auswahl auf, wenn es schon ausgewählt ist).
 * Die Auswahl steht in der Adresse, damit man sie teilen und zurückblättern kann.
 * @param {string} id - Hausnummer, z. B. "6B"
 */
function select(id) {
  router.replace({ path: '/campus', query: selected.value === id ? {} : { haus: id } });
}
</script>

<template>
  <main class="page">
    <h1>Campus Lichtenberg</h1>

    <p v-if="room && selected" class="card campus-info">
      Raum <strong>{{ room }}</strong> ist in <strong>Haus {{ selected }}</strong>.
    </p>
    <p v-else-if="selected" class="card campus-info">
      <strong>Haus {{ selected }}</strong> ist markiert.
    </p>

    <div class="card campus-map">
      <svg viewBox="0 0 860 740" role="img" aria-label="Lageplan Campus Lichtenberg">
        <!-- Gelände -->
        <polygon class="ground" points="10,60 850,60 850,350 41,727 10,727" />

        <!-- Straße -->
        <rect class="street" x="0" y="14" width="860" height="34" />
        <text class="street-label" x="430" y="36">Alt-Friedrichsfelde</text>

        <!-- Bushaltestellen und Parkplatz -->
        <g class="stop">
          <circle cx="40" cy="70" r="9" />
          <text x="40" y="74">H</text>
        </g>
        <text class="map-note" x="56" y="74">Bildungs- und Verwaltungszentrum</text>
        <g class="stop">
          <circle cx="800" cy="70" r="9" />
          <text x="800" y="74">H</text>
        </g>
        <text class="map-note" x="786" y="96" text-anchor="end">Alt-Friedrichsfelde/Gensinger Str.</text>
        <g class="parking">
          <rect x="525" y="100" width="22" height="22" rx="4" />
          <text x="536" y="116">P</text>
        </g>

        <!-- Andere Gebäude -->
        <polygon v-for="(points, i) in OTHER_BUILDINGS" :key="'o' + i" class="other" :points="points" />

        <!-- Gänge zwischen den Häusern -->
        <polygon v-for="(points, i) in CONNECTORS" :key="'c' + i" class="connector" :points="points" />

        <!-- HWR-Gebäude -->
        <g
          v-for="b in BUILDINGS"
          :key="b.id"
          class="building"
          :class="{ selected: selected === b.id, dimmed: selected && selected !== b.id }"
          role="button"
          tabindex="0"
          :aria-label="`Haus ${b.id}`"
          :aria-pressed="selected === b.id"
          @click="select(b.id)"
          @keydown.enter.prevent="select(b.id)"
          @keydown.space.prevent="select(b.id)"
        >
          <polygon :points="b.points" />
          <circle :cx="b.label[0]" :cy="b.label[1]" r="17" />
          <text :x="b.label[0]" :y="b.label[1] + 5">{{ b.id }}</text>
        </g>

        <text class="map-note" x="20" y="712">Alfred-Kowalke-Str.</text>
      </svg>
    </div>

    <div class="building-buttons">
      <button
        v-for="b in BUILDINGS"
        :key="b.id"
        type="button"
        :class="{ secondary: selected !== b.id }"
        @click="select(b.id)"
      >
        Haus {{ b.id }}
      </button>
    </div>

    <p class="muted section">
      Nachgezeichnet nach dem Lageplan der HWR Berlin. Tippe auf ein Haus, um es zu markieren.
    </p>
  </main>
</template>
