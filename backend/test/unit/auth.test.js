import { describe, expect, it } from "vitest";
import {
  getGroups,
  getPrimaryRole,
  getUser,
  hasRole,
  requireRole
} from "../../src/lib/auth.js";
import { lambdaEvent } from "../helpers/events.js";

describe("auth helpers", () => {
  it("lee grupos Cognito desde un string", () => {
    // Arrange
    const event = lambdaEvent();
    event.requestContext.authorizer.jwt.claims["cognito:groups"] = "[ADMIN, SECRETARIA]";

    // Act
    const groups = getGroups(event);

    // Assert
    expect(groups).toEqual(["ADMIN", "SECRETARIA"]);
    expect(hasRole(event, ["SECRETARIA"])).toBe(true);
  });

  it("lanza 403 cuando el rol no esta autorizado", () => {
    // Arrange
    const event = lambdaEvent({ role: "CLIENTE" });

    // Act
    const action = () => requireRole(event, ["ADMIN"]);

    // Assert
    expect(action).toThrow("Acceso no autorizado");
    try {
      action();
    } catch (error) {
      expect(error.statusCode).toBe(403);
    }
  });

  it("devuelve rol anonimo y usuario por defecto si no hay claims", () => {
    // Arrange
    const event = {};

    // Act
    const role = getPrimaryRole(event);
    const user = getUser(event);

    // Assert
    expect(role).toBe("ANONIMO");
    expect(user).toEqual({
      sub: undefined,
      email: undefined,
      name: "Usuario"
    });
  });

  it("parsea grupos cuando es un array", () => {
    // Arrange
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

    // Act
    const groups = getGroups(event);

    // Assert
    expect(groups).toEqual(["ADMIN", "BARBERO"]);
  });

  it("devuelve rol desde claim role cuando no hay cognito:groups", () => {
    // Arrange
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

    // Act
    const groups = getGroups(event);
    const role = getPrimaryRole(event);

    // Assert
    expect(groups).toEqual(["SECRETARIA"]);
    expect(role).toBe("SECRETARIA");
  });

  it("da acceso cuando rol esta en la lista permitida", () => {
    // Arrange
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

    // Act & Assert
    expect(hasRole(event, ["ADMIN", "SUPER"])).toBe(true);
    expect(hasRole(event, ["BARBERO"])).toBe(false);
  });

  it("getUser usa email como nombre cuando no hay name", () => {
    // Arrange
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

    // Act
    const user = getUser(event);

    // Assert
    expect(user).toEqual({
      sub: "user-1",
      email: "user@demo.local",
      name: "user@demo.local"
    });
  });

  it("getUser sin claims devuelve usuario anonimo", () => {
    // Arrange
    const event = { requestContext: {} };

    // Act
    const user = getUser(event);

    // Assert
    expect(user.name).toBe("Usuario");
  });
});
