import { randomUUID } from 'node:crypto';
import { AppError, forbidden, notFound } from '../lib/errors.js';
import { assertDate, assertTime, requireFields } from '../lib/validation.js';
import { getItem, putItem, scanByType, updateItem } from '../lib/repository.js';
import { audit } from '../lib/audit.js';
import { getBusinessConfig, getService } from './business-service.js';
import { getUser, listUsers } from './user-service.js';
import { calculateAvailability } from './availability-service.js';

const enrich = async (appointment) => {
  const [client, barber, service] = await Promise.all([
    getUser(appointment.clientId).catch(() => null),
    getUser(appointment.barberId).catch(() => null),
    getService(appointment.serviceId).catch(() => null)
  ]);
  return {
    ...appointment,
    clientName: client?.name || 'Cliente',
    clientPhone: client?.phone || '',
    barberName: barber?.name || 'Barbero',
    serviceName: service?.name || 'Servicio',
    price: service?.price ?? appointment.price
  };
};

export async function listBarbers() {
  return listUsers({ role: 'BARBERO' }).then((items) => items.filter((item) => item.active !== false));
}

export async function getAvailability({ date, serviceId, barberId, excludeAppointmentId }) {
  requireFields({ date, serviceId, barberId }, ['date', 'serviceId', 'barberId']);
  assertDate(date);
  const [service, business, appointments] = await Promise.all([
    getService(serviceId),
    getBusinessConfig(),
    scanByType('APPOINTMENT')
  ]);
  const dayAppointments = appointments.filter((item) => item.date === date && item.barberId === barberId && item.id !== excludeAppointmentId);
  return calculateAvailability({
    openTime: business.openTime,
    closeTime: business.closeTime,
    slotMinutes: Number(business.slotMinutes || 30),
    serviceDuration: Number(service.duration),
    appointments: dayAppointments
  });
}

export async function createAppointment(payload, actor, source = 'ONLINE') {
  requireFields(payload, ['clientId', 'serviceId', 'barberId', 'date', 'time']);
  assertDate(payload.date);
  assertTime(payload.time);
  if (actor.role === 'CLIENTE' && payload.clientId !== actor.sub) throw forbidden('Solo puedes reservar para tu propia cuenta');
  const [client, barber, service] = await Promise.all([
    getUser(payload.clientId),
    getUser(payload.barberId),
    getService(payload.serviceId)
  ]);
  if (client.role !== 'CLIENTE') throw new AppError('El usuario seleccionado no es cliente', 422, 'VALIDATION_ERROR');
  if (barber.role !== 'BARBERO' || barber.active === false) throw new AppError('Barbero no disponible', 422, 'VALIDATION_ERROR');
  const available = await getAvailability(payload);
  if (!available.includes(payload.time)) throw new AppError('El horario ya no está disponible', 409, 'SLOT_UNAVAILABLE');
  const id = randomUUID();
  const appointment = {
    PK: `APPOINTMENT#${id}`,
    SK: 'META',
    GSI1PK: `DATE#${payload.date}`,
    GSI1SK: `${payload.time}#${payload.barberId}`,
    entityType: 'APPOINTMENT',
    id,
    clientId: payload.clientId,
    serviceId: payload.serviceId,
    barberId: payload.barberId,
    date: payload.date,
    time: payload.time,
    duration: service.duration,
    price: service.price,
    notes: String(payload.notes || '').trim(),
    source,
    status: 'PENDIENTE',
    createdAt: new Date().toISOString()
  };
  await putItem(appointment);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CREATE_APPOINTMENT', resource: `APPOINTMENT#${id}`, details: { source } });
  return enrich(appointment);
}

export async function listAppointments(filters = {}, actor) {
  let appointments = await scanByType('APPOINTMENT');
  if (filters.clientId) appointments = appointments.filter((item) => item.clientId === filters.clientId);
  if (filters.barberId) appointments = appointments.filter((item) => item.barberId === filters.barberId);
  if (filters.date) appointments = appointments.filter((item) => item.date === filters.date);
  if (filters.status) appointments = appointments.filter((item) => item.status === filters.status);
  if (actor?.role === 'CLIENTE') appointments = appointments.filter((item) => item.clientId === actor.sub);
  if (actor?.role === 'BARBERO') appointments = appointments.filter((item) => item.barberId === actor.sub);
  appointments.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return Promise.all(appointments.map(enrich));
}

export async function rescheduleAppointment(id, payload, actor) {
  requireFields(payload, ['date', 'time']);
  const current = await getItem(`APPOINTMENT#${id}`);
  if (!current) throw notFound('Reserva no encontrada');
  if (actor.role === 'CLIENTE' && current.clientId !== actor.sub) throw forbidden();
  if (['CANCELADA', 'ATENDIDA'].includes(current.status)) throw new AppError('La reserva ya no puede reprogramarse', 409, 'INVALID_STATUS');
  const barberId = payload.barberId || current.barberId;
  const available = await getAvailability({ date: payload.date, serviceId: current.serviceId, barberId, excludeAppointmentId: id });
  if (!available.includes(payload.time)) throw new AppError('El nuevo horario no está disponible', 409, 'SLOT_UNAVAILABLE');
  const updates = {
    date: payload.date,
    time: payload.time,
    barberId,
    status: 'PENDIENTE',
    updatedAt: new Date().toISOString()
  };
  const updated = await updateItem(`APPOINTMENT#${id}`, updates);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'RESCHEDULE_APPOINTMENT', resource: `APPOINTMENT#${id}`, details: updates });
  return enrich(updated);
}

export async function cancelAppointment(id, actor) {
  const current = await getItem(`APPOINTMENT#${id}`);
  if (!current) throw notFound('Reserva no encontrada');
  if (actor.role === 'CLIENTE' && current.clientId !== actor.sub) throw forbidden();
  if (current.status === 'ATENDIDA') throw new AppError('Una cita atendida no puede cancelarse', 409, 'INVALID_STATUS');
  const updated = await updateItem(`APPOINTMENT#${id}`, { status: 'CANCELADA', cancelledAt: new Date().toISOString() });
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CANCEL_APPOINTMENT', resource: `APPOINTMENT#${id}` });
  return enrich(updated);
}

export async function updateAppointmentStatus(id, status, actor) {
  const allowed = ['PENDIENTE', 'CONFIRMADA', 'EN_ATENCION', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA'];
  if (!allowed.includes(status)) throw new AppError('Estado de cita inválido', 422, 'VALIDATION_ERROR');
  const current = await getItem(`APPOINTMENT#${id}`);
  if (!current) throw notFound('Reserva no encontrada');
  if (actor.role === 'BARBERO' && current.barberId !== actor.sub) throw forbidden('Solo puedes modificar citas de tu agenda');
  const updated = await updateItem(`APPOINTMENT#${id}`, { status, updatedAt: new Date().toISOString() });
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'UPDATE_APPOINTMENT_STATUS', resource: `APPOINTMENT#${id}`, details: { status } });
  return enrich(updated);
}
