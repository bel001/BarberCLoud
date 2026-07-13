import { describe, expect, it, vi } from 'vitest';
import { lambdaResponse, ok } from '../../src/lib/response.js';
import { parseBody, wrap } from '../../src/lib/lambda.js';
import { AppError } from '../../src/lib/errors.js';

describe('response and lambda helpers', () => {
  it('crea respuesta de dominio exitosa', () => {
    expect(ok({ id: 1 }, 'Creado')).toEqual({ ok: true, message: 'Creado', data: { id: 1 } });
  });

  it('crea respuesta Lambda JSON con CORS', () => {
    const response = lambdaResponse(201, { ok: true });
    expect(response.statusCode).toBe(201);
    expect(response.headers['content-type']).toBe('application/json');
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it('parsea cuerpo objeto, JSON y vacío', () => {
    expect(parseBody({ body: { name: 'Ana' } })).toEqual({ name: 'Ana' });
    expect(parseBody({ body: '{"name":"Ana"}' })).toEqual({ name: 'Ana' });
    expect(parseBody({})).toEqual({});
  });

  it('wrap convierte AppError en respuesta controlada', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = wrap(() => { throw new AppError('Inválido', 422, 'VALIDATION_ERROR'); });
    const response = await handler({});
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({ ok: false, error: 'VALIDATION_ERROR', message: 'Inválido' });
    spy.mockRestore();
  });

  it('wrap oculta errores internos', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = wrap(() => { throw new Error('secreto'); });
    const response = await handler({});
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe('Error interno');
    spy.mockRestore();
  });
});
