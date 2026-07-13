import { describe, expect, it, vi, beforeEach } from "vitest";

// Pruebas de auditoria: verifican que cada accion quede persistida.
// Preparar el mock antes de vi.mock porque Vitest eleva esas llamadas.
const { putItemMock } = vi.hoisted(() => {
  const mock = vi.fn().mockResolvedValue(undefined);
  return { putItemMock: mock, putItem: mock };
});

vi.mock("uuid", () => ({
  v4: () => "audit-id"
}));

vi.mock("../../src/lib/dynamodb.js", () => ({ putItem: putItemMock }));

import { audit } from "../../src/lib/audit.js";

describe("audit", () => {
  beforeEach(() => {
    putItemMock.mockClear();
  });

  it("registra accion con usuario y rol del evento", async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "admin-1",
              email: "admin@demo.local",
              "cognito:groups": ["ADMIN"]
            }
          }
        }
      }
    };

    await audit(event, "SERVICIO_CREAR", "OK", { servicioId: "corte" });

    expect(putItemMock).toHaveBeenCalledTimes(1);
    expect(putItemMock.mock.calls[0][0].gsi1pk).toBe("AUDIT_USER#admin-1");
    expect(putItemMock.mock.calls[0][0].tipo).toBe("AUDIT_LOG");
    expect(putItemMock.mock.calls[0][0].action).toBe("SERVICIO_CREAR");
    expect(putItemMock.mock.calls[0][0].responsable).toBe("admin@demo.local");
  });

  it("usa sub en gsi1pk y usa sub como usuarioId", async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "user-123",
              "cognito:groups": ["BARBERO"]
            }
          }
        }
      }
    };

    await audit(event, "RESERVA_CREAR", "OK");

    expect(putItemMock.mock.calls[0][0].gsi1pk).toBe("AUDIT_USER#user-123");
  });

  it("usa email cuando no hay sub", async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              email: "cliente@demo.local",
              "cognito:groups": ["CLIENTE"]
            }
          }
        }
      }
    };

    await audit(event, "RESERVA_CANCELAR", "OK");

    expect(putItemMock.mock.calls[0][0].gsi1pk).toBe("AUDIT_USER#cliente@demo.local");
    expect(putItemMock.mock.calls[0][0].responsable).toBe("cliente@demo.local");
  });

  it("usa system cuando no hay sub ni email", async () => {
    const event = {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              "cognito:groups": ["SYSTEM"]
            }
          }
        }
      }
    };

    await audit(event, "CRON_JOB", "OK");

    expect(putItemMock.mock.calls[0][0].gsi1pk).toBe("AUDIT_USER#system");
    expect(putItemMock.mock.calls[0][0].usuarioId).toBe("system");
  });
});
