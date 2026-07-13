import { randomUUID } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import { requireFields } from '../lib/validation.js';
import { getItem, putItem, scanByType, updateItem } from '../lib/repository.js';
import { audit } from '../lib/audit.js';

export async function getCurrentCashSession() {
  const sessions = await scanByType('CASH_SESSION');
  return sessions.find((session) => session.status === 'OPEN') || null;
}

export async function openCash(payload, actor) {
  if (await getCurrentCashSession()) throw new AppError('Ya existe una caja abierta', 409, 'CASH_ALREADY_OPEN');
  const id = randomUUID();
  const session = {
    PK: `CASH#${id}`,
    SK: 'META',
    GSI1PK: 'CASH',
    GSI1SK: new Date().toISOString(),
    entityType: 'CASH_SESSION',
    id,
    openedBy: actor.sub,
    openingAmount: Number(payload.openingAmount || 0),
    status: 'OPEN',
    openedAt: new Date().toISOString()
  };
  await putItem(session);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'OPEN_CASH', resource: `CASH#${id}` });
  return session;
}

export async function closeCash(payload, actor) {
  const current = await getCurrentCashSession();
  if (!current) throw new AppError('No existe una caja abierta', 409, 'CASH_NOT_OPEN');
  const sales = (await scanByType('SALE')).filter((sale) => sale.cashSessionId === current.id);
  const expectedAmount = current.openingAmount + sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const updates = {
    status: 'CLOSED',
    closingAmount: Number(payload.closingAmount ?? expectedAmount),
    expectedAmount,
    difference: Number(payload.closingAmount ?? expectedAmount) - expectedAmount,
    closedBy: actor.sub,
    closedAt: new Date().toISOString()
  };
  const updated = await updateItem(`CASH#${current.id}`, updates);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CLOSE_CASH', resource: `CASH#${current.id}`, details: updates });
  return updated;
}

export async function createSale(payload, actor) {
  requireFields(payload, ['items', 'paymentMethod']);
  const cash = await getCurrentCashSession();
  if (!cash) throw new AppError('Debes abrir caja antes de registrar ventas', 409, 'CASH_NOT_OPEN');
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new AppError('La venta debe incluir al menos un concepto', 422, 'VALIDATION_ERROR');
  const normalizedItems = payload.items.map((item) => ({
    description: String(item.description || '').trim(),
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    subtotal: Number(item.quantity || 1) * Number(item.unitPrice || 0)
  }));
  const total = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const id = randomUUID();
  const sale = {
    PK: `SALE#${id}`,
    SK: 'META',
    GSI1PK: `SALE_DATE#${new Date().toISOString().slice(0, 10)}`,
    GSI1SK: new Date().toISOString(),
    entityType: 'SALE',
    id,
    cashSessionId: cash.id,
    clientId: payload.clientId || null,
    appointmentId: payload.appointmentId || null,
    items: normalizedItems,
    paymentMethod: payload.paymentMethod,
    total,
    createdBy: actor.sub,
    createdAt: new Date().toISOString()
  };
  await putItem(sale);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CREATE_SALE', resource: `SALE#${id}`, details: { total } });
  return sale;
}

export async function listSales() {
  const sales = await scanByType('SALE');
  return sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
