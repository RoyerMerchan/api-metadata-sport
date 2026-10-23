import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth';
import { useClub } from '../stores/club';
import Shell from '../layouts/Shell.vue';
export const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/auth/:mode?', component: () => import('../views/AuthView.vue') },
  { path: '/', component: Shell, children: [
    { path: 'welcome', component: () => import('../views/WelcomeView.vue') },
    { path: '', name: 'home', component: () => import('../views/DashboardView.vue') },
    { path: 'explore', component: () => import('../views/ExploreView.vue') },
    { path: 'analyze', component: () => import('../views/AnalyzeView.vue') },
    { path: 'club', component: () => import('../views/ClubView.vue') },
    { path: 'profile', component: () => import('../views/ProfileView.vue') },
    { path: 'players/:id', component: () => import('../views/PlayerView.vue') },
    { path: 'matches/:id', component: () => import('../views/MatchView.vue') },
  ] }, { path: '/:pathMatch(.*)*', redirect: '/' },
] });
router.beforeEach(async to => {
  const auth = useAuth(); await auth.initialize();
  if (!auth.user && !to.path.startsWith('/auth')) return '/auth/login';
  if (auth.user) {
    if (to.path.startsWith('/auth')) return '/';
    const club = useClub();
    if (!club.loaded) { try { await club.load(); } catch { return; } }
    if (!club.selectedId && to.path !== '/welcome' && to.path !== '/profile') return '/welcome';
  }
});
window.addEventListener('footlab:unauthorized', () => { useAuth().expired(); router.replace('/auth/login'); });
