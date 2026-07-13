import { describe, expect, it, vi } from 'vitest';
import { allow, createToken, hashPassword, verifyToken } from '../../src/lib/auth.js';
import { eventUser, requireEventRole } from '../../src/lib/lambda.js';
import { lambdaEvent } from '../helpers/events.js';

describe('auth helpers', () => {
  it('genera hash determinista sin guardar la contraseña', () => {
    const hash = hashPassword('BarberCloud2026!');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashPassword('BarberCloud2026!'));
    expect(hash).not.toContain('BarberCloud');
  });

  it('crea y verifica token local', () => {
    const token = createToken({ id: 'u1', email: 'u@demo.local', name: 'Usuario', role: 'CLIENTE' });
    expect(verifyToken(token)).toMatchObject({ sub: 'u1', role: 'CLIENTE' });
  });

  it('rechaza token alterado y token vencido', () => {
    const token = createToken({ id: 'u1', role: 'CLIENTE' });
    expect(() => verifyToken(`${token}x`)).toThrow();
    expect(() => verifyToken(createToken({ id: 'u1', role: 'CLIENTE' }, -1))).toThrow('expiró');
  });

  it('lee usuario y grupos Cognito de un evento Lambda', () => {
    const event = lambdaEvent({ role: 'ADMIN', groups: 'ADMIN, SECRETARIA', user: { sub: 'admin-1' } });
    expect(eventUser(event)).toMatchObject({ sub: 'admin-1', role: 'ADMIN' });
  });

  it('admin hereda permisos de secretaria y barbero', () => {
    expect(requireEventRole(lambdaEvent({ role: 'ADMIN' }), 'SECRETARIA').role).toBe('ADMIN');
    expect(requireEventRole(lambdaEvent({ role: 'ADMIN' }), 'BARBERO').role).toBe('ADMIN');
  });

  it('rechaza rol Lambda no autorizado', () => {
    expect(() => requireEventRole(lambdaEvent({ role: 'CLIENTE' }), 'ADMIN')).toThrow('permisos');
  });

  it('middleware allow deja pasar roles válidos y bloquea otros', () => {
    const nextOk = vi.fn();
    allow('SECRETARIA')({ user: { role: 'ADMIN' } }, {}, nextOk);
    expect(nextOk).toHaveBeenCalledWith();

    const nextDenied = vi.fn();
    allow('ADMIN')({ user: { role: 'CLIENTE' } }, {}, nextDenied);
    expect(nextDenied.mock.calls[0][0].statusCode).toBe(403);
  });
});
