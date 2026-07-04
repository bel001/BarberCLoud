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
});
