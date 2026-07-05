import { describe, expect, it, vi } from "vitest";
import { calculateCashTotal, createPosService, validateSaleInput } from "../../src/services/posService.js";
import { lambdaEvent } from "../helpers/events.js";
import { createRepositoryMock, fixedClock, fixedId } from "../helpers/mocks.js";

describe("posService", () => {
  it("calcula total de caja con valores numericos y texto", () => {
    // Arrange
    const ventas = [{ total: 20 }, { total: "30" }, {}];

    // Act
    const total = calculateCashTotal(ventas);

    // Assert
    expect(total).toBe(50);
  });

  it("lista ventas y totaliza caja", async () => {
    // Arrange
    const repository = createRepositoryMock({
      scanByTipo: vi.fn().mockResolvedValue([{ total: 15 }, { total: "25" }])
    });
    const service = createPosService({
      repository,
      auditLog: vi.fn(),
      idGenerator: fixedId(),
      clock: fixedClock()
    });

    // Act
    const result = await service.listSales();

    // Assert
    expect(repository.scanByTipo).toHaveBeenCalledWith("VENTA");
    expect(result).toEqual({
      ventas: [{ total: 15 }, { total: "25" }],
      total: 40
    });
  });

  it("registra venta con responsable, auditoria y fecha estable", async () => {
    // Arrange
    const repository = createRepositoryMock();
    const auditLog = vi.fn().mockResolvedValue(undefined);
    const service = createPosService({
      repository,
      auditLog,
      idGenerator: fixedId("venta-id"),
      clock: fixedClock("2026-07-04T13:00:00.000Z")
    });
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      user: { email: "secretaria@demo.local", sub: "secretaria-1" },
      body: {
        concepto: "Corte clasico",
        total: "30",
        metodoPago: "TARJETA"
      }
    });

    // Act
    const result = await service.registerSale(event);

    // Assert
    expect(result).toEqual({
      message: "Venta registrada",
      ventaId: "venta_venta-id"
    });
    expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CAJA#2026-07-04",
      tipo: "VENTA",
      ventaId: "venta_venta-id",
      concepto: "Corte clasico",
      total: 30,
      metodoPago: "TARJETA",
      responsable: "secretaria@demo.local"
    }));
    expect(auditLog).toHaveBeenCalledWith(event, "POS_VENTA_REGISTRAR", "OK", {
      ventaId: "venta_venta-id",
      total: 30
    });
  });

  it("valida venta y usa efectivo por defecto", () => {
    // Arrange
    const body = { concepto: "Corte", total: "30" };

    // Act
    const result = validateSaleInput(body);

    // Assert
    expect(result).toEqual({ concepto: "Corte", total: 30, metodoPago: "EFECTIVO" });
  });

  it("rechaza venta sin concepto o total", () => {
    // Arrange
    const body = { concepto: "Corte" };

    // Act
    const action = () => validateSaleInput(body);

    // Assert
    expect(action).toThrow("concepto y total son obligatorios");
  });

  it("rechaza venta cuando el evento no trae body", async () => {
    // Arrange
    const service = createPosService({
      repository: createRepositoryMock(),
      auditLog: vi.fn(),
      idGenerator: fixedId(),
      clock: fixedClock()
    });
    const event = lambdaEvent({ method: "POST", role: "SECRETARIA" });

    // Act
    const action = () => service.registerSale(event);

    // Assert
    await expect(action).rejects.toThrow("concepto y total son obligatorios");
  });

  it("registra venta usando reloj real cuando no se inyecta clock", async () => {
    // Arrange
    const repository = createRepositoryMock();
    const service = createPosService({
      repository,
      auditLog: vi.fn().mockResolvedValue(undefined),
      idGenerator: fixedId("venta-real")
    });
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      user: { email: "secretaria@demo.local" },
      body: { concepto: "Corte", total: 30 }
    });

    // Act
    const result = await service.registerSale(event);

    // Assert
    expect(result).toEqual({ message: "Venta registrada", ventaId: "venta_venta-real" });
    expect(repository.putItem.mock.calls[0][0].creadoEn).toEqual(expect.any(String));
  });
});
