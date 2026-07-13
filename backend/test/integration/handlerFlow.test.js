import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lambdaEvent, parseBody } from '../helpers/events.js';

const mocks = vi.hoisted(() => ({
  createAppointment: vi.fn(), cancelAppointment: vi.fn(),
  listAppointments: vi.fn(), rescheduleAppointment: vi.fn()
}));
vi.mock('../../src/services/appointment-service.js', () => mocks);

import { handler as createReservationHandler } from '../../src/handlers/nuevaReserva.js';
import { handler as cancelReservationHandler } from '../../src/handlers/cancelarReserva.js';
import { handler as clientReservationsHandler } from '../../src/handlers/gestionReservasCliente.js';

describe('reservation handler flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea reserva online con identidad del token', async () => {
    mocks.createAppointment.mockResolvedValue({ id: 'a1', status: 'PENDIENTE' });
    const event = lambdaEvent({
      method: 'POST', rawPath: '/api/client/appointments',
      body: { serviceId: 's1', barberId: 'b1', date: '2026-07-15', time: '09:00' },
      user: { sub: 'client-1' }, role: 'CLIENTE'
    });
    const response = await createReservationHandler(event);
    expect(response.statusCode).toBe(200);
    expect(mocks.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1' }),
      expect.objectContaining({ sub: 'client-1', role: 'CLIENTE' }),
      'ONLINE'
    );
  });

  it('cancela reserva desde path parameter', async () => {
    mocks.cancelAppointment.mockResolvedValue({ id: 'a1', status: 'CANCELADA' });
    const response = await cancelReservationHandler(lambdaEvent({
      method: 'DELETE', rawPath: '/api/client/appointments/a1', pathParameters: { id: 'a1' }, role: 'CLIENTE'
    }));
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).data.status).toBe('CANCELADA');
    expect(mocks.cancelAppointment).toHaveBeenCalledWith('a1', expect.objectContaining({ role: 'CLIENTE' }));
  });

  it('rechaza cancelación con rol de barbero', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await cancelReservationHandler(lambdaEvent({
      method: 'DELETE', pathParameters: { id: 'a1' }, role: 'BARBERO'
    }));
    expect(response.statusCode).toBe(403);
    expect(parseBody(response).error).toBe('FORBIDDEN');
    spy.mockRestore();
  });

  it('lista y reprograma reservas del cliente', async () => {
    mocks.listAppointments.mockResolvedValue([{ id: 'a1' }]);
    let response = await clientReservationsHandler(lambdaEvent({ role: 'CLIENTE', user: { sub: 'client-1' } }));
    expect(parseBody(response).data).toEqual([{ id: 'a1' }]);

    mocks.rescheduleAppointment.mockResolvedValue({ id: 'a1', time: '10:00' });
    response = await clientReservationsHandler(lambdaEvent({
      method: 'PUT', role: 'CLIENTE', pathParameters: { id: 'a1' },
      body: { date: '2026-07-16', time: '10:00' }
    }));
    expect(mocks.rescheduleAppointment).toHaveBeenCalledWith('a1', { date: '2026-07-16', time: '10:00' }, expect.any(Object));
    expect(parseBody(response).data.time).toBe('10:00');
  });
});
