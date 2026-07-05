import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("uuid", () => ({
  v4: () => "audit-id"
}));

const putItemMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/lib/dynamodb.js", () => ({
  putItem: (...args) => putItemMock(...args)
}));

describe("audit", () => {
  beforeEach(() => {
    putItemMock.mockClear();
  });

  it("registra accion con usuario y rol del evento", async () => {
    const { audit } = await import("../../src/lib/audit.js");
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "admin-1",
              email: "admin@demo.local",
              name: "Admin Demo",
              "cognito:groups": ["ADMIN"]
            }
          }
        }
      }
    };

    await audit(event, "SERVICIO_CREAR", "OK", { servicioId: "corte" });

    expect(putItemMock).toHaveBeenCalledWith(expect.objectContaining({
      gsi1pk: "AUDIT_USER#admin-1",
      tipo: "AUDIT_LOG",
      action: "SERVICIO_CREAR",
      status: "OK",
      responsable: "admin@demo.local",
      usuarioId: "admin-1",
      rol: "ADMIN",
      detail: { servicioId: "corte" }
    }));
  });

  it("usa sub en gsi1pk cuando esta presente", async () => {
    const { audit } = await import("../../src/lib/audit.js");
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "user-123",
              email: "test@demo.local",
              name: "Test User",
              "cognito:groups": ["BARBERO"]
            }
          }
        }
      }
    };

    await audit(event, "RESERVA_CREAR", "OK");

    expect(putItemMock).toHaveBeenCalledWith(expect.objectContaining({
      gsi1pk: "AUDIT_USER#user-123"
    }));
  });

  it("registra audit log con campos correctos", async () => {
    const { audit } = await import("../../src/lib/audit.js");
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "barbero-1",
              email: "barbero@demo.local",
              name: "Barbero Uno",
              "cognito:groups": ["BARBERO"]
            }
          }
        }
      }
    };

    await audit(event, "CORTE_COMPLETADO", "OK", { reservaId: "res-999" });

    const call = putItemMock.mock.calls[0][0];
    expect(call.pk).toMatch(/^AUDIT#\d{4}-\d{2}-\d{2}$/);
    expect(call.sk).toContain("#audit-id");
    expect(call.tipo).toBe("AUDIT_LOG");
    expect(call.action).toBe("CORTE_COMPLETADO");
    expect(call.rol).toBe("BARBERO");
    expect(call.detail).toEqual({ reservaId: "res-999" });
  });
});