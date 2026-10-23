<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import { useClub } from '../stores/club';
import { errorMessage } from '../services/api';
import StateNotice from '../components/StateNotice.vue';
const auth = useAuth(), club = useClub(); const error = ref(''), ready = ref(false);
const route = useRoute(), router = useRouter();
const links = [{ to: '/', icon: 'pi-home', label: 'Inicio' }, { to: '/explore', icon: 'pi-compass', label: 'Explorar' }, { to: '/analyze', icon: 'pi-chart-bar', label: 'Analizar' }, { to: '/club', icon: 'pi-shield', label: 'Mi Club' }, { to: '/profile', icon: 'pi-user', label: 'Perfil' }];
async function load() { error.value = ''; try { if (!club.loaded) await club.load(); if (!club.selectedId && !['/welcome', '/profile'].includes(route.path)) await router.replace('/welcome'); } catch (e) { error.value = errorMessage(e); } finally { ready.value = club.loaded; } }
onMounted(load);
async function changeTeam(event: Event) { error.value = ''; try { await club.select((event.target as HTMLSelectElement).value); } catch (e) { error.value = errorMessage(e); } }
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar"><RouterLink class="brand" to="/"><span class="brand-mark">f<span>↗</span></span> FOOTLAB<span class="brand-dot">.</span></RouterLink><div class="side-caption">EL JUEGO, EN PERSPECTIVA</div><nav><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: $route.path === link.to }"><i aria-hidden="true" :class="['pi', link.icon]" /><span>{{ link.label }}</span><i aria-hidden="true" class="pi pi-angle-right nav-arrow" /></RouterLink></nav><div class="side-bottom"><div class="signal"><span /> Tu espacio de trabajo</div><p>Datos para entender.<br>Decisiones para crecer.</p><span class="muted">FOOTLAB / 01</span></div></aside>
    <div class="main-shell">
      <header class="topbar"><RouterLink class="brand mobile-brand" to="/">FOOTLAB<span class="brand-dot">.</span></RouterLink><div class="breadcrumb">WORKSPACE <span>/</span> <strong>{{ links.find(l => l.to === $route.path)?.label ?? 'Detalle' }}</strong></div><div class="top-actions"><label class="workspace-select"><i aria-hidden="true" class="pi pi-shield" /><select aria-label="Organización activa" :value="club.selectedId" :disabled="club.changing" @change="changeTeam"><option v-if="!club.memberships.length" value="">Sin club</option><option v-for="m in club.memberships" :key="m.organization.id" :value="m.organization.id">{{ m.organization.name }}</option></select></label><RouterLink to="/welcome" class="icon-button" aria-label="Crear o unirme a un equipo"><i aria-hidden="true" class="pi pi-plus" /></RouterLink><RouterLink to="/profile" class="avatar" aria-label="Mi perfil">{{ auth.user?.name.slice(0, 1) }}</RouterLink></div></header>
      <main><div v-if="error" class="alert error">{{ error }}</div><RouterView v-if="ready" :key="`${club.sessionId}:${club.selectedId}:${$route.fullPath}`" /><StateNotice v-else :loading="!error" :error="error" @retry="load" /></main><footer class="page-footer">FOOTLAB <span>ESTADÍSTICA CON CONTEXTO.</span><span>CLUB · PRO · LAB</span></footer>
    </div><nav class="bottom-nav"><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: $route.path === link.to }"><i aria-hidden="true" :class="['pi', link.icon]" /><span>{{ link.label }}</span></RouterLink></nav>
  </div>
</template>
