import { AppError, forbidden, unauthorized } from './errors.js';
import { lambdaResponse } from './response.js';

export const parseBody = (event) => {
  if (!event?.body) return {};
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch {
    throw new AppError('Cuerpo JSON inválido', 400, 'INVALID_JSON');
  }
};

export const eventUser = (event) => {
  const claims = event?.requestContext?.authorizer?.jwt?.claims || {};
  const groups = String(claims['cognito:groups'] || claims.role || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!claims.sub) throw unauthorized('Token sin identidad de usuario');
  const role = groups.includes('ADMIN') ? 'ADMIN' : groups[0] || 'CLIENTE';
  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    role
  };
};

export function requireEventRole(event, ...roles) {
  const user = eventUser(event);
  const expanded = new Set(roles);
  if (roles.includes('SECRETARIA')) expanded.add('ADMIN');
  if (roles.includes('BARBERO')) expanded.add('ADMIN');
  if (!expanded.has(user.role)) throw forbidden();
  return user;
}

export const eventPath = (event) => event?.rawPath || event?.requestContext?.http?.path || '';
export const eventMethod = (event) => event?.requestContext?.http?.method || '';

export function wrap(handler) {
  return async (event) => {
    try {
      const data = await handler(event);
      return lambdaResponse(200, { ok: true, data });
    } catch (error) {
      console.error(error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      return lambdaResponse(statusCode, {
        ok: false,
        error: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
        message: error instanceof AppError ? error.message : 'Error interno'
      });
    }
  };
}
