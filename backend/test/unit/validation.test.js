import { describe, expect, it } from 'vitest';
import { assertDate, assertEmail, assertTime, normalizeText, requireFields } from '../../src/lib/validation.js';

describe('validation helpers', () => {
  it('acepta payload completo', () => {
    expect(() => requireFields({ name: 'Corte', price: 30 }, ['name', 'price'])).not.toThrow();
  });

  it('reporta todos los campos faltantes', () => {
    expect(() => requireFields({ name: '' }, ['name', 'price'])).toThrow('name, price');
  });

  it.each(['cliente@correo.com', 'a+b@dominio.pe'])('acepta correo válido %s', (email) => {
    expect(() => assertEmail(email)).not.toThrow();
  });

  it.each(['correo', '@dominio.com', 'a@'])('rechaza correo inválido %s', (email) => {
    expect(() => assertEmail(email)).toThrow('Correo electrónico inválido');
  });

  it('valida fecha y hora', () => {
    expect(() => assertDate('2026-07-15')).not.toThrow();
    expect(() => assertTime('19:30')).not.toThrow();
    expect(() => assertDate('15/07/2026')).toThrow();
    expect(() => assertTime('25:00')).toThrow();
  });

  it('normaliza texto y valores nulos', () => {
    expect(normalizeText('  BarberCloud  ')).toBe('BarberCloud');
    expect(normalizeText(null)).toBe('');
  });
});
