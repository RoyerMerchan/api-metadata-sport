import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { acceptSession, api, clearSession, refreshSession } from '../services/api';
import { useClub } from './club';
interface User { id: string; name: string; email: string; globalRole: string }
export const useAuth = defineStore('auth', () => {
  const user = ref<User | null>(null); const ready = ref(false); let initializing: Promise<void> | null = null;
  async function initialize() {
    if (ready.value) return;
    if (!initializing) initializing = (async () => { try { const data = await refreshSession(); if (data) user.value = data.user; } catch (error) { if (!axios.isAxiosError(error) || error.response?.status === 401) await clearSession(); } finally { ready.value = true; } })();
    return initializing;
  }
  async function signIn(path: 'login' | 'register', values: unknown) { const { data } = await api.post(`/auth/${path}`, values); await acceptSession(data); useClub().reset(); user.value = data.user; ready.value = true; }
  async function logout() { await api.post('/auth/logout'); await clearSession(); useClub().reset(); user.value = null; }
  function expired() { useClub().reset(); user.value = null; }
  return { user, ready, initialize, signIn, logout, expired };
});
