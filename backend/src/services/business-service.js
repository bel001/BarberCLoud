import { randomUUID } from 'node:crypto';
import { AppError, notFound } from '../lib/errors.js';
import { normalizeText, requireFields } from '../lib/validation.js';
import { getItem, putItem, scanByType, updateItem } from '../lib/repository.js';
import { audit } from '../lib/audit.js';

export async function listServices({ activeOnly = true } = {}) {
  let services = await scanByType('SERVICE');
  if (activeOnly) services = services.filter((service) => service.active !== false);
  return services.sort((a, b) => a.price - b.price);
}

export async function getService(id) {
  const service = await getItem(`SERVICE#${id}`);
  if (!service) throw notFound('Servicio no encontrado');
  return service;
}

export async function createService(payload, actor) {
  requireFields(payload, ['name', 'duration', 'price']);
  const duration = Number(payload.duration);
  const price = Number(payload.price);
  if (duration < 15 || duration > 240 || price < 0) throw new AppError('Duración o precio inválido', 422, 'VALIDATION_ERROR');
  const id = randomUUID();
  const service = {
    PK: `SERVICE#${id}`,
    SK: 'META',
    GSI1PK: 'SERVICES',
    GSI1SK: normalizeText(payload.name).toLowerCase(),
    entityType: 'SERVICE',
    id,
    name: normalizeText(payload.name),
    description: normalizeText(payload.description),
    duration,
    price,
    active: true,
    createdAt: new Date().toISOString()
  };
  await putItem(service);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CREATE_SERVICE', resource: `SERVICE#${id}` });
  return service;
}

export async function updateService(id, payload, actor) {
  const current = await getService(id);
  const updates = {
    name: normalizeText(payload.name || current.name),
    description: payload.description === undefined ? current.description : normalizeText(payload.description),
    duration: payload.duration === undefined ? current.duration : Number(payload.duration),
    price: payload.price === undefined ? current.price : Number(payload.price),
    active: payload.active === undefined ? current.active : Boolean(payload.active),
    updatedAt: new Date().toISOString()
  };
  const updated = await updateItem(`SERVICE#${id}`, updates);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'UPDATE_SERVICE', resource: `SERVICE#${id}`, details: updates });
  return updated;
}

export async function getBusinessConfig() {
  const config = await getItem('BUSINESS#CONFIG');
  if (!config) throw notFound('Configuración del negocio no encontrada');
  return config;
}

export async function updateBusinessConfig(payload, actor) {
  const current = await getBusinessConfig();
  const updates = {
    name: normalizeText(payload.name || current.name),
    phone: normalizeText(payload.phone || current.phone),
    address: normalizeText(payload.address || current.address),
    openTime: payload.openTime || current.openTime,
    closeTime: payload.closeTime || current.closeTime,
    slotMinutes: Number(payload.slotMinutes || current.slotMinutes),
    cancellationHours: Number(payload.cancellationHours ?? current.cancellationHours),
    currency: payload.currency || current.currency,
    updatedAt: new Date().toISOString()
  };
  const updated = await updateItem('BUSINESS#CONFIG', updates);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'UPDATE_BUSINESS', resource: 'BUSINESS#CONFIG', details: updates });
  return updated;
}
