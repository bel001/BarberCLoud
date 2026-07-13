import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getItem: vi.fn(), putItem: vi.fn(async (item) => item), scanByType: vi.fn(), updateItem: vi.fn(),
  audit: vi.fn(), getUser: vi.fn(), listUsers: vi.fn(), getService: vi.fn(), getBusinessConfig: vi.fn()
}));

vi.mock('../../src/lib/repository.js', () => ({
  getItem: mocks.getItem,
  putItem: mocks.putItem,
  scanByType: mocks.scanByType,
  updateItem: mocks.updateItem
}));
vi.mock('../../src/lib/audit.js', () => ({ audit: mocks.audit }));
vi.mock('../../src/services/user-service.js', () => ({ getUser: mocks.getUser, listUsers: mocks.listUsers }));
vi.mock('../../src/services/business-service.js', () => ({
  getService: mocks.getService,
  getBusinessConfig: mocks.getBusinessConfig
}));
vi.mock('node:crypto', () => ({ randomUUID: () => 'appointment-id' }));

import {
  cancelAppointment,
  createAppointment,
  getAvailability,
  listAppointments,
  rescheduleAppointment,
  updateAppointmentStatus
} from '../../src/services/appointment-service.js';

const client = { id: 'client-1', name: 'Cliente Uno', phone: '999111222', role: 'CLIENTE', active: true };
const barber = { id: 'barber-1', name: 'Barbero Uno', role: 'BARBERO', active: true };
const service = { id: 'service-1', name: 'Corte clásico', duration: 30, price: 30, active: true };
const actor = { sub: 'client-1', role: 'CLIENTE' };

function configureBase() {
  mocks.getBusinessConfig.mockResolvedValue({ openTime: '09:00', closeTime: '11:00', slotMinutes: 30 });
  mocks.getService.mockResolvedValue(service);
  mocks.getUser.mockImplementation(async (id) => {
    if (id === client.id) return client;
    if (id === barber.id) return barber;
    throw new Error('not found');
  });
  mocks.scanByType.mockResolvedValue([]);
  mocks.updateItem.mockImplementation(async (_pk, updates) => ({
    id: 'appointment-id', clientId: client.id, barberId: barber.id, serviceId: service.id,
    date: '2026-07-15', time: '10:00', duration: 30, price: 30, status: 'PENDIENTE', ...updates
  }));
}

describe('reservation service integration with repositories mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureBase();
  });

  it('consulta disponibilidad usando configuración, servicio y reservas', async () => {
    mocks.scanByType.mockResolvedValue([{ id: 'other', date: '2026-07-15', barberId: barber.id, time: '09:30', duration: 30, status: 'CONFIRMADA' }]);
    const result = await getAvailability({ date: '2026-07-15', serviceId: service.id, barberId: barber.id });
    expect(result).toEqual(['09:00', '10:00', '10:30']);
  });

  it('crea una reserva online y la enriquece', async () => {
    const result = await createAppointment({
      clientId: client.id, barberId: barber.id, serviceId: service.id,
      date: '2026-07-15', time: '09:00', notes: 'Sin máquina'
    }, actor, 'ONLINE');
    expect(result).toMatchObject({
      id: 'appointment-id', clientName: 'Cliente Uno', barberName: 'Barbero Uno',
      serviceName: 'Corte clásico', source: 'ONLINE', status: 'PENDIENTE'
    });
    expect(mocks.putItem).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE_APPOINTMENT' }));
  });

  it('impide al cliente reservar para otra cuenta', async () => {
    await expect(createAppointment({
      clientId: 'other-client', barberId: barber.id, serviceId: service.id,
      date: '2026-07-15', time: '09:00'
    }, actor)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rechaza horario ocupado', async () => {
    mocks.scanByType.mockImplementation(async (type) => type === 'APPOINTMENT'
      ? [{ id: 'occupied', date: '2026-07-15', barberId: barber.id, time: '09:00', duration: 30, status: 'CONFIRMADA' }]
      : []);
    expect(await getAvailability({ date: '2026-07-15', serviceId: service.id, barberId: barber.id })).not.toContain('09:00');
    await expect(createAppointment({
      clientId: client.id, barberId: barber.id, serviceId: service.id,
      date: '2026-07-15', time: '09:00'
    }, actor)).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
  });

  it('filtra citas según el rol del actor', async () => {
    mocks.scanByType.mockResolvedValue([
      { id: 'a1', clientId: client.id, barberId: barber.id, serviceId: service.id, date: '2026-07-15', time: '09:00' },
      { id: 'a2', clientId: 'other', barberId: barber.id, serviceId: service.id, date: '2026-07-15', time: '10:00' }
    ]);
    const result = await listAppointments({}, actor);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('reprograma una cita válida', async () => {
    mocks.getItem.mockResolvedValue({
      id: 'appointment-id', clientId: client.id, barberId: barber.id, serviceId: service.id,
      date: '2026-07-15', time: '09:00', duration: 30, status: 'PENDIENTE'
    });
    const result = await rescheduleAppointment('appointment-id', { date: '2026-07-15', time: '10:00' }, actor);
    expect(result.time).toBe('10:00');
    expect(mocks.updateItem).toHaveBeenCalledWith('APPOINTMENT#appointment-id', expect.objectContaining({ time: '10:00', status: 'PENDIENTE' }));
  });

  it('cancela una cita propia y rechaza una cita atendida', async () => {
    mocks.getItem.mockResolvedValue({
      id: 'appointment-id', clientId: client.id, barberId: barber.id, serviceId: service.id,
      date: '2026-07-15', time: '09:00', duration: 30, status: 'PENDIENTE'
    });
    expect((await cancelAppointment('appointment-id', actor)).status).toBe('CANCELADA');

    mocks.getItem.mockResolvedValue({
      id: 'appointment-id', clientId: client.id, barberId: barber.id, serviceId: service.id,
      status: 'ATENDIDA'
    });
    await expect(cancelAppointment('appointment-id', actor)).rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('barbero solo cambia estados de su agenda', async () => {
    mocks.getItem.mockResolvedValue({
      id: 'appointment-id', clientId: client.id, barberId: 'barber-2', serviceId: service.id,
      date: '2026-07-15', time: '09:00', status: 'CONFIRMADA'
    });
    await expect(updateAppointmentStatus('appointment-id', 'ATENDIDA', { sub: barber.id, role: 'BARBERO' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
