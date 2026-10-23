import { Capacitor, registerPlugin } from '@capacitor/core';
interface VaultPlugin { get(): Promise<{ value?: string }>; set(options: { value: string }): Promise<void>; clear(): Promise<void> }
const native = registerPlugin<VaultPlugin>('FootlabVault');
export const vault = {
  async get() { return Capacitor.isNativePlatform() ? (await native.get()).value ?? null : sessionStorage.getItem('footlab.refresh'); },
  async set(value: string) { if (Capacitor.isNativePlatform()) await native.set({ value }); else sessionStorage.setItem('footlab.refresh', value); },
  async clear() { if (Capacitor.isNativePlatform()) await native.clear(); else sessionStorage.removeItem('footlab.refresh'); },
};
