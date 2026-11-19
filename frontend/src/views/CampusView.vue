<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BUILDINGS, PLAN_WIDTH, PLAN_HEIGHT, buildingFromRoom } from '../campus';

const route = useRoute();
const router = useRouter();

// Ausgewähltes Haus: direkt (?haus=6B) oder aus dem Raum abgeleitet (?raum=6B.450)
const selected = computed(() => {
  const haus = String(route.query.haus || '').toUpperCase();
  if (BUILDINGS.some(b => b.id === haus)) return haus;
  return buildingFromRoom(route.query.raum);
});

// Bereich, in dem sich der Plan auf schmalen Bildschirmen seitlich schieben lässt
const scrollBox = ref(null);

/**
 * Schiebt den Plan auf schmalen Bildschirmen so, dass das ausgewählte Haus in der Mitte ist.
 */
async function scrollToSelected() {
  await nextTick();
  const box = scrollBox.value;
  const b = BUILDINGS.find(x => x.id === selected.value);
  if (!box || !b) return;
  const x = (b.label[0] / PLAN_WIDTH) * box.scrollWidth;
  box.scrollTo({ left: x - box.clientWidth / 2, behavior: 'smooth' });
}

watch(selected, scrollToSelected);
onMounted(scrollToSelected);

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
  <main class="page page-wide">
    <h1>Campus Lichtenberg</h1>
    <p class="muted campus-address">Alt-Friedrichsfelde 60, 10315 Berlin</p>

    <!-- Lageplan der HWR mit runden, anklickbaren Hausnummern darüber -->
    <div class="card campus-map">
      <div ref="scrollBox" class="campus-scroll">
        <div class="plan">
          <img src="/campus-plan.jpg" alt="Lageplan Campus Lichtenberg" :width="PLAN_WIDTH" :height="PLAN_HEIGHT">
          <svg :viewBox="`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`">
            <g
              v-for="b in BUILDINGS"
              :key="b.id"
              class="building"
              :class="{ selected: selected === b.id }"
              :transform="`translate(${b.label[0]} ${b.label[1]})`"
              role="button"
              tabindex="0"
              :aria-label="`Haus ${b.id}`"
              :aria-pressed="selected === b.id"
              @click="select(b.id)"
              @keydown.enter.prevent="select(b.id)"
              @keydown.space.prevent="select(b.id)"
            >
              <!-- Pulsierender Ring um das gesuchte Haus -->
              <circle v-if="selected === b.id" class="halo" r="60" />
              <circle class="tag" r="52" />
              <text y="15">{{ b.id }}</text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  </main>
</template>
