import { createRouter, createWebHistory } from 'vue-router';
import { getAuth } from './api';
import LoginView from './views/LoginView.vue';
import RegisterView from './views/RegisterView.vue';
import DashboardView from './views/DashboardView.vue';
import DecksView from './views/DecksView.vue';
import CardsView from './views/CardsView.vue';
import CardFormView from './views/CardFormView.vue';
import LearnView from './views/LearnView.vue';
import GradesView from './views/GradesView.vue';
import GradeFormView from './views/GradeFormView.vue';
import GoalView from './views/GoalView.vue';
import TimetableView from './views/TimetableView.vue';

// Alle Seiten der App. "public: true" heißt: auch ohne Anmeldung erreichbar.
const routes = [
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/register', component: RegisterView, meta: { public: true } },
  { path: '/', component: DashboardView },
  { path: '/decks', component: DecksView },
  { path: '/cards', component: CardsView },
  { path: '/cards/new', component: CardFormView },
  { path: '/cards/:id/edit', component: CardFormView },
  { path: '/learn/:deckId', component: LearnView },
  { path: '/grades', component: GradesView },
  { path: '/grades/new', component: GradeFormView },
  { path: '/grades/:id/edit', component: GradeFormView },
  { path: '/grades/goal', component: GoalView },
  { path: '/timetable', component: TimetableView }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Vor jedem Seitenwechsel: Wer nicht angemeldet ist, landet auf der Login-Seite
router.beforeEach(to => {
  if (!to.meta.public && !getAuth()) {
    return '/login';
  }
});

export default router;
