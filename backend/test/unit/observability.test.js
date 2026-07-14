import { describe, expect, it } from 'vitest';
import {
  classifyBusinessEvent,
  normalizeRoute,
} from '../../src/lib/observability.js';

describe('observabilidad', () => {
  it('normaliza identificadores dinámicos para evitar cardinalidad alta', () => {
    expect(normalizeRoute('/api/client/appointments/123/reschedule?source=web'))
      .toBe('/api/client/appointments/:id/reschedule');
    expect(normalizeRoute('/api/client/appointments/550e8400-e29b-41d4-a716-446655440000'))
      .toBe('/api/client/appointments/:id');
  });

  it('clasifica reservas creadas exitosamente', () => {
    expect(classifyBusinessEvent({
      method: 'POST',
      route: '/api/client/appointments',
      statusCode: 200,
    })?.event).toBe('reserva_creada');
  });

  it('no contabiliza una reserva cuando la solicitud falla', () => {
    expect(classifyBusinessEvent({
      method: 'POST',
      route: '/api/client/appointments',
      statusCode: 400,
    })).toBeNull();
  });

  it('clasifica los intentos de login fallidos', () => {
    expect(classifyBusinessEvent({
      method: 'POST',
      route: '/api/auth/login',
      statusCode: 401,
    })?.event).toBe('login_fallido');
  });
});
