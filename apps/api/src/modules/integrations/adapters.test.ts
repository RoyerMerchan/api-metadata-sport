import { describe, expect, it } from 'vitest';
import { footballRequest, position, positionMinutes } from './adapters';
describe('normalización de proveedores', () => {
  it('mapea posiciones y suma intervalos reales', () => { expect(position('Centre-Back')).toBe('DF'); expect(position('Goalkeeper')).toBe('GK'); expect(positionMinutes([{ from: '00:00', to: '45:00' }, { from: '45:00', to: '60:30' }])).toBe(61); });
  it('no asigna minutos cuando no hay datos', () => { expect(positionMinutes([])).toBeNull(); expect(positionMinutes([{ from: '00:00', to: null }])).toBeNull(); });
  it('rechaza rutas inyectadas en el código de competición', () => { expect(footballRequest.safeParse({ competition: '../../users', season: 2026 }).success).toBe(false); });
});
