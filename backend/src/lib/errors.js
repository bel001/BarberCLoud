export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (message = 'Recurso no encontrado') => new AppError(message, 404, 'NOT_FOUND');
export const forbidden = (message = 'No tienes permisos para esta acción') => new AppError(message, 403, 'FORBIDDEN');
export const unauthorized = (message = 'Debes iniciar sesión') => new AppError(message, 401, 'UNAUTHORIZED');
