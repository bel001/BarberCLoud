import { AppError } from './errors.js';

export const requireFields = (payload, fields) => {
  const missing = fields.filter((field) => payload?.[field] === undefined || payload?.[field] === null || payload?.[field] === '');
  if (missing.length) {
    throw new AppError(`Faltan campos obligatorios: ${missing.join(', ')}`, 422, 'VALIDATION_ERROR');
  }
};

export const assertEmail = (email) => {
  if (!/^\S+@\S+\.\S+$/.test(String(email || ''))) {
    throw new AppError('Correo electrónico inválido', 422, 'VALIDATION_ERROR');
  }
};

export const assertDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new AppError('Fecha inválida. Usa el formato YYYY-MM-DD', 422, 'VALIDATION_ERROR');
  }
};

export const assertTime = (time) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) {
    throw new AppError('Hora inválida. Usa el formato HH:mm', 422, 'VALIDATION_ERROR');
  }
};

export const normalizeText = (value) => String(value ?? '').trim();
