import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { acceptSession, api, clearSession, errorMessage } from './api';
const storage = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('./vault', () => ({ vault: { get: async () => storage.token, set: async (value: string) => { storage.token = value; }, clear: async () => { storage.token = null; } } }));
const originalAdapter = api.defaults.adapter;
afterEach(async () => { api.defaults.adapter = originalAdapter; await clearSession(); });
describe('cliente de la API', () => {
  it('explica conexión perdida y conserva errores de validación', () => { expect(errorMessage(new AxiosError('Network Error'))).toContain('conectar'); const err = new AxiosError('Bad Request', '400', undefined, undefined, { data: { message: 'No tienes permiso' }, status: 403, statusText: 'Forbidden', headers: {}, config: {} as any }); expect(errorMessage(err)).toBe('No tienes permiso'); });
  it.each([200, 401])('descarta una respuesta antigua %s al cambiar de cuenta sin borrar la sesión nueva', async status => {
    await acceptSession({ accessToken: 'account-A', refreshToken: 'refresh-A' });
    let complete!: () => void, markStarted!: () => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    api.defaults.adapter = config => new Promise((resolve, reject) => { complete = () => { const response = { data: { private: 'account-A' }, status, statusText: '', headers: {}, config }; if (status === 401) reject(new AxiosError('Unauthorized', '401', config, undefined, response)); else resolve(response); }; markStarted(); });
    const pending = api.get('/players'); await started;
    await acceptSession({ accessToken: 'account-B', refreshToken: 'refresh-B' }); complete();
    await expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' }); expect(storage.token).toBe('refresh-B');
    api.defaults.adapter = async config => ({ data: config.headers.Authorization, status: 200, statusText: 'OK', headers: {}, config });
    expect((await api.get('/auth/session')).data).toBe('Bearer account-B');
  });
});
