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
    // Preparar: definir datos, mocks y contexto del caso
    const payload = { message: "ok" };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const response = ok(payload);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("application/json");
    expect(parseBody(response)).toEqual(payload);
  });

  it("crea respuestas de recurso creado", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const payload = { id: "res_1" };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const response = created(payload);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual(payload);
  });

  it("crea errores de validacion", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const message = "campo obligatorio";

    // Ejecutar: llamar la funcion o handler bajo prueba
    const response = badRequest(message);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: message });
  });

  it("oculta errores internos pero respeta errores controlados", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const internal = new Error("secreto interno");
    const forbidden = new Error("Acceso no autorizado");
    forbidden.statusCode = 403;
    const conflict = { name: "TransactionCanceledException" };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const internalResponse = serverError(internal);
    const forbiddenResponse = serverError(forbidden);
    const conflictResponse = serverError(conflict);

    // Verificar: confirmar la respuesta y los efectos esperados
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
    // Preparar: definir datos, mocks y contexto del caso
    process.env.ENVIRONMENT = "prod";
    process.env.ALLOWED_ORIGINS = "https://barbercloud.example";

    // Ejecutar: llamar la funcion o handler bajo prueba
    const response = ok({ message: "ok" });

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(response.headers["Access-Control-Allow-Origin"]).toBe("https://barbercloud.example");
  });
});
