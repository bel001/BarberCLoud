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
    const event = lambdaEvent();
    event.requestContext.authorizer.jwt.claims["cognito:groups"] = "[ADMIN, SECRETARIA]";

    const groups = getGroups(event);

    expect(groups).toEqual(["ADMIN", "SECRETARIA"]);
    expect(hasRole(event, ["SECRETARIA"])).toBe(true);
  });

  it("lanza 403 cuando el rol no esta autorizado", () => {
    const event = lambdaEvent({ role: "CLIENTE" });

    const action = () => requireRole(event, ["ADMIN"]);

    expect(action).toThrow("Acceso no autorizado");
    try {
      action();
    } catch (error) {
      expect(error.statusCode).toBe(403);
    }
  });

  it("devuelve rol anonimo y usuario por defecto si no hay claims", () => {
    const event = {};

    const role = getPrimaryRole(event);
    const user = getUser(event);

    expect(role).toBe("ANONIMO");
    expect(user).toEqual({
      sub: undefined,
      email: undefined,
      name: "Usuario"
    });
  });

  it("parsea grupos cuando es un array", () => {
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

    const groups = getGroups(event);

    expect(groups).toEqual(["ADMIN", "BARBERO"]);
  });

  it("devuelve rol desde claim role cuando no hay cognito:groups", () => {
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

    const groups = getGroups(event);
    const role = getPrimaryRole(event);

    expect(groups).toEqual(["SECRETARIA"]);
    expect(role).toBe("SECRETARIA");
  });

  it("da acceso cuando rol esta en la lista permitida", () => {
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

    expect(hasRole(event, ["ADMIN", "SUPER"])).toBe(true);
    expect(hasRole(event, ["BARBERO"])).toBe(false);
  });

  it("getUser usa email como nombre cuando no hay name", () => {
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

    const user = getUser(event);

    expect(user).toEqual({
      sub: "user-1",
      email: "user@demo.local",
      name: "user@demo.local"
    });
  });

  it("getUser sin claims devuelve usuario anonimo", () => {
    const event = { requestContext: {} };

    const user = getUser(event);

    expect(user.name).toBe("Usuario");
  });
});
