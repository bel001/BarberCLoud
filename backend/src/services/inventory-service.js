import { randomUUID } from 'node:crypto';
import { AppError, notFound } from '../lib/errors.js';
import { requireFields } from '../lib/validation.js';
import { getItem, putItem, scanByType, updateItem } from '../lib/repository.js';
import { audit } from '../lib/audit.js';

export async function listInventory() {
  const items = await scanByType('INVENTORY');
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createInventoryItem(payload, actor) {
  requireFields(payload, ['name', 'stock', 'unit', 'minimum']);
  const id = randomUUID();
  const item = {
    PK: `INVENTORY#${id}`,
    SK: 'META',
    GSI1PK: 'INVENTORY',
    GSI1SK: String(payload.name).toLowerCase(),
    entityType: 'INVENTORY',
    id,
    name: String(payload.name).trim(),
    stock: Number(payload.stock),
    unit: String(payload.unit).trim(),
    minimum: Number(payload.minimum),
    cost: Number(payload.cost || 0),
    active: true,
    createdAt: new Date().toISOString()
  };
  await putItem(item);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CREATE_INVENTORY', resource: `INVENTORY#${id}` });
  return item;
}

export async function updateInventory(id, payload, actor) {
  const item = await getItem(`INVENTORY#${id}`);
  if (!item) throw notFound('Insumo no encontrado');
  const updates = {
    stock: payload.stock === undefined ? item.stock : Number(payload.stock),
    minimum: payload.minimum === undefined ? item.minimum : Number(payload.minimum),
    cost: payload.cost === undefined ? item.cost : Number(payload.cost),
    active: payload.active === undefined ? item.active : Boolean(payload.active),
    updatedAt: new Date().toISOString()
  };
  if (updates.stock < 0) throw new AppError('El stock no puede ser negativo', 422, 'VALIDATION_ERROR');
  const updated = await updateItem(`INVENTORY#${id}`, updates);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'UPDATE_INVENTORY', resource: `INVENTORY#${id}`, details: updates });
  return updated;
}

export async function registerUsage(payload, actor) {
  requireFields(payload, ['inventoryId', 'quantity']);
  const item = await getItem(`INVENTORY#${payload.inventoryId}`);
  if (!item) throw notFound('Insumo no encontrado');
  const quantity = Number(payload.quantity);
  if (quantity <= 0 || item.stock < quantity) throw new AppError('Cantidad inválida o stock insuficiente', 409, 'INSUFFICIENT_STOCK');
  const updated = await updateItem(`INVENTORY#${item.id}`, { stock: item.stock - quantity, updatedAt: new Date().toISOString() });
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'USE_INVENTORY', resource: `INVENTORY#${item.id}`, details: { quantity, appointmentId: payload.appointmentId } });
  return updated;
}
