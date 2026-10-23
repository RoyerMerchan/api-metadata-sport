import axios from 'axios';
import { vault } from './vault';
export const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const transport = axios.create({ baseURL, timeout: 20000 });
export const api = axios.create({ baseURL, timeout: 20000 });
let accessToken: string | null = null; let refreshing: Promise<any> | null = null; let generation = 0;
let vaultQueue: Promise<void> = Promise.resolve();
function writeVault(epoch: number, value: string | null) {
  const action = vaultQueue.catch(() => {}).then(async () => { if (epoch === generation) { if (value) await vault.set(value); else await vault.clear(); } });
  vaultQueue = action; return action;
}
export async function acceptSession(data: { accessToken: string; refreshToken: string }) { const epoch = ++generation; accessToken = null; refreshing = null; await writeVault(epoch, data.refreshToken); if (epoch === generation) accessToken = data.accessToken; }
export async function clearSession() { const epoch = ++generation; accessToken = null; refreshing = null; await writeVault(epoch, null); }
export function refreshSession() {
  if (!refreshing) {
    const epoch = generation;
    const pending = (async () => { const token = await vault.get(); if (!token || epoch !== generation) return null; const { data } = await transport.post('/auth/refresh', { refreshToken: token }); if (epoch !== generation) throw new axios.CanceledError('Sesión cambiada'); await writeVault(epoch, data.refreshToken); if (epoch !== generation) throw new axios.CanceledError('Sesión cambiada'); accessToken = data.accessToken; return data; })().finally(() => { if (refreshing === pending) refreshing = null; });
    refreshing = pending;
  }
  return refreshing;
}
api.interceptors.request.use(config => { (config as any)._sessionGeneration = generation; if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`; return config; });
api.interceptors.response.use(res => { if ((res.config as any)._sessionGeneration !== generation) throw new axios.CanceledError('Sesión cambiada'); return res; }, async error => {
  const config = error.config;
  if (config && config._sessionGeneration !== generation) throw new axios.CanceledError('Sesión cambiada');
  if (error.response?.status === 401 && config && !config._retried && !/^\/auth\/(login|register|refresh|forgot-password|reset-password)(?:$|\/)/.test(config.url ?? '')) {
    config._retried = true;
    try { const session = await refreshSession(); if (session) { config.headers.Authorization = `Bearer ${session.accessToken}`; return api(config); } } catch (refreshError) { if (axios.isCancel(refreshError) || config._sessionGeneration !== generation) throw refreshError; if (axios.isAxiosError(refreshError) && ![400, 401].includes(refreshError.response?.status ?? 0)) throw refreshError; }
    if (config._sessionGeneration !== generation) throw new axios.CanceledError('Sesión cambiada');
    await clearSession(); window.dispatchEvent(new Event('footlab:unauthorized'));
  } throw error;
});
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) { if (!error.response) return 'No se pudo conectar con la API. Revisa la conexión e inténtalo de nuevo.'; const msg = error.response.data?.message; return typeof msg === 'string' ? msg : 'No se pudo completar la operación. Revisa los datos.'; }
  return error instanceof Error ? error.message : 'No se pudo completar la operación';
}
