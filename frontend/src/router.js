import { createRouter, createWebHistory } from 'vue-router';
import { getAuth } from './api';
import LoginView from './views/LoginView.vue';
import RegisterView from './views/RegisterView.vue';
import DashboardView from './views/DashboardView.vue';

// Alle Seiten der App. "public: true" heißt: auch ohne Anmeldung erreichbar.
const routes = [
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/register', component: RegisterView, meta: { public: true } },
  { path: '/', component: DashboardView }
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
