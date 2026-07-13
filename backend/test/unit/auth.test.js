import { describe, expect, it } from "vitest";
import {
  getGroups,
  getPrimaryRole,
  getUser,
  hasRole,
  requireRole
} from "../../src/lib/auth.js";
import { lambdaEvent } from "../helpers/events.js";

// Pruebas de autenticacion y roles: verifican claims,
// grupos Cognito y rechazo cuando el rol no esta autorizado.
describe("auth helpers", () => {
  it("lee grupos Cognito desde un string", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = lambdaEvent();
    event.requestContext.authorizer.jwt.claims["cognito:groups"] = "[ADMIN, SECRETARIA]";

    // Ejecutar: llamar la funcion o handler bajo prueba
    const groups = getGroups(event);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(groups).toEqual(["ADMIN", "SECRETARIA"]);
    expect(hasRole(event, ["SECRETARIA"])).toBe(true);
  });

  it("lanza 403 cuando el rol no esta autorizado", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = lambdaEvent({ role: "CLIENTE" });

    // Ejecutar: llamar la funcion o handler bajo prueba
    const action = () => requireRole(event, ["ADMIN"]);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(action).toThrow("Acceso no autorizado");
    try {
      action();
    } catch (error) {
      expect(error.statusCode).toBe(403);
    }
  });

  it("devuelve rol anonimo y usuario por defecto si no hay claims", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = {};

    // Ejecutar: llamar la funcion o handler bajo prueba
    const role = getPrimaryRole(event);
    const user = getUser(event);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(role).toBe("ANONIMO");
    expect(user).toEqual({
      sub: undefined,
      email: undefined,
      name: "Usuario"
    });
  });

  it("parsea grupos cuando es un array", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              "cognito:groups": ["ADMIN", "BARBERO"]
            }
          }
        }
      }
    };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const groups = getGroups(event);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(groups).toEqual(["ADMIN", "BARBERO"]);
  });

  it("devuelve rol desde claim role cuando no hay cognito:groups", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              role: "SECRETARIA"
            }
          }
        }
      }
    };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const groups = getGroups(event);
    const role = getPrimaryRole(event);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(groups).toEqual(["SECRETARIA"]);
    expect(role).toBe("SECRETARIA");
  });

  it("da acceso cuando rol esta en la lista permitida", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              "cognito:groups": ["ADMIN"]
            }
          }
        }
      }
    };

    // Ejecutar y verificar: disparar la accion y confirmar el resultado
    expect(hasRole(event, ["ADMIN", "SUPER"])).toBe(true);
    expect(hasRole(event, ["BARBERO"])).toBe(false);
  });

  it("getUser usa email como nombre cuando no hay name", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "user-1",
              email: "user@demo.local"
            }
          }
        }
      }
    };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const user = getUser(event);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(user).toEqual({
      sub: "user-1",
      email: "user@demo.local",
      name: "user@demo.local"
    });
  });

  it("getUser sin claims devuelve usuario anonimo", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const event = { requestContext: {} };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const user = getUser(event);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(user.name).toBe("Usuario");
  });
});
