import { afterEach, describe, expect, it } from "vitest";
import { badRequest, created, ok, serverError } from "../../src/lib/response.js";
import { parseBody } from "../helpers/events.js";

// Pruebas de respuestas HTTP: aseguran formato JSON, CORS,
// codigos de estado y manejo consistente de errores.
describe("response helpers", () => {
  afterEach(() => {
    delete process.env.ENVIRONMENT;
    delete process.env.NODE_ENV;
    delete process.env.ALLOWED_ORIGINS;
  });

  it("crea respuestas exitosas json", () => {
    const payload = { message: "ok" };

    const response = ok(payload);

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("application/json");
    expect(parseBody(response)).toEqual(payload);
  });

  it("crea respuestas de recurso creado", () => {
    const payload = { id: "res_1" };

    const response = created(payload);

    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual(payload);
  });

  it("crea errores de validacion", () => {
    const message = "campo obligatorio";

    const response = badRequest(message);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: message });
  });

  it("oculta errores internos pero respeta errores controlados", () => {
    const internal = new Error("secreto interno");
    const forbidden = new Error("Acceso no autorizado");
    forbidden.statusCode = 403;
    const conflict = { name: "TransactionCanceledException" };

    const internalResponse = serverError(internal);
    const forbiddenResponse = serverError(forbidden);
    const conflictResponse = serverError(conflict);

    expect(internalResponse.statusCode).toBe(500);
    expect(parseBody(internalResponse)).toEqual({ error: "Error interno del servidor" });
    expect(forbiddenResponse.statusCode).toBe(403);
    expect(parseBody(forbiddenResponse)).toEqual({ error: "Acceso no autorizado" });
    expect(conflictResponse.statusCode).toBe(400);
    expect(parseBody(conflictResponse)).toEqual({
      error: "La operacion no pudo completarse de forma consistente"
    });
  });

  it("devuelve error generico para errores desconocido", () => {
    const unknown = new Error("error desconocido");
    const response = serverError(unknown);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });

  it("usa origen permitido configurado fuera de ambiente dev", () => {
    process.env.ENVIRONMENT = "prod";
    process.env.ALLOWED_ORIGINS = "https://barbercloud.example";

    const response = ok({ message: "ok" });

    expect(response.headers["Access-Control-Allow-Origin"]).toBe("https://barbercloud.example");
  });
});
