import { describe, expect, it, vi } from "vitest";
import { lambdaEvent } from "../helpers/events.js";

vi.mock("uuid", () => ({
  v4: () => "audit-id"
}));

vi.mock("../../src/lib/dynamodb.js", () => ({
  putItem: vi.fn().mockResolvedValue(undefined)
}));

describe("audit", () => {
  it("registra accion con usuario y rol del evento", async () => {
    // Arrange
    const { audit } = await import("../../src/lib/audit.js");
    const { putItem } = await import("../../src/lib/dynamodb.js");
    const event = lambdaEvent({
      role: "ADMIN",
      user: {
        sub: "admin-1",
        email: "admin@demo.local",
        name: "Admin Demo"
      }
    });

    // Act
    await audit(event, "SERVICIO_CREAR", "OK", { servicioId: "corte" });

    // Assert
    expect(putItem).toHaveBeenCalledWith(expect.objectContaining({
      gsi1pk: "AUDIT_USER#admin-1",
      tipo: "AUDIT_LOG",
      action: "SERVICIO_CREAR",
      status: "OK",
      responsable: "admin@demo.local",
      usuarioId: "admin-1",
      rol: "ADMIN",
      detail: { servicioId: "corte" }
    }));
    expect(putItem.mock.calls[0][0].sk).toContain("#audit-id");
  });
});
