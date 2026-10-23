import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from './auth';
describe('autorización y fallos de conectividad', () => {
  const context: any = { getHandler: () => () => {}, getClass: () => AuthGuard, switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer test-token' } }) }) };
  const reflector: any = { getAllAndOverride: () => false };
  const jwt: any = { verifyAsync: async () => ({ type: 'access', sub: 'user', sid: 'session' }) };
  it('propaga una caída de base de datos sin convertirla en sesión inválida', async () => {
    const failure = Object.assign(new Error('database unavailable'), { code: 'P1001' });
    const db: any = { session: { findFirst: async () => { throw failure; } } };
    await expect(new AuthGuard(reflector, jwt, db).canActivate(context)).rejects.toBe(failure);
  });
  it('rechaza una sesión revocada o inexistente', async () => {
    const db: any = { session: { findFirst: async () => null } };
    await expect(new AuthGuard(reflector, jwt, db).canActivate(context)).rejects.toMatchObject({ status: 401 });
  });
  it('rechaza un refresh token presentado como access token', async () => {
    const wrongJwt: any = { verifyAsync: async () => ({ type: 'refresh' }) };
    await expect(new AuthGuard(reflector, wrongJwt, {} as any).canActivate(context)).rejects.toMatchObject({ status: 401 });
  });
});
