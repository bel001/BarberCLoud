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
      total: 40,
      sesionCaja: null
    });
  });

  it("lista ventas incluyendo la sesion de caja abierta del dia", async () => {
    // Arrange
    const repository = createRepositoryMock({
      scanByTipo: vi.fn().mockResolvedValue([]),
      queryByPk: vi.fn().mockResolvedValue([
        { tipo: "CAJA_SESION", estado: "ABIERTA", sesionId: "sesion-1", montoInicial: 50 }
      ])
    });
    const service = createPosService({
      repository,
      auditLog: vi.fn(),
      idGenerator: fixedId(),
      clock: fixedClock("2026-07-04T13:00:00.000Z")
    });

    // Act
    const result = await service.listSales();

    // Assert
    expect(repository.queryByPk).toHaveBeenCalledWith("CAJA#2026-07-04");
    expect(result.sesionCaja).toEqual({ tipo: "CAJA_SESION", estado: "ABIERTA", sesionId: "sesion-1", montoInicial: 50 });
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
      ventaId: "venta_venta-id",
      impuesto: 5.4,
      totalConImpuesto: 35.4
    });
    expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CAJA#2026-07-04",
      tipo: "VENTA",
      ventaId: "venta_venta-id",
      concepto: "Corte clasico",
      total: 30,
      impuesto: 5.4,
      totalConImpuesto: 35.4,
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
    expect(result).toEqual({ message: "Venta registrada", ventaId: "venta_venta-real", impuesto: 5.4, totalConImpuesto: 35.4 });
    expect(repository.putItem.mock.calls[0][0].creadoEn).toEqual(expect.any(String));
  });

  describe("apertura y cierre de caja", () => {
    it("abre una caja con monto inicial", async () => {
      // Arrange
      const repository = createRepositoryMock({ queryByPk: vi.fn().mockResolvedValue([]) });
      const auditLog = vi.fn().mockResolvedValue(undefined);
      const service = createPosService({
        repository,
        auditLog,
        idGenerator: fixedId("sesion-1"),
        clock: fixedClock("2026-07-04T08:00:00.000Z")
      });
      const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: { montoInicial: 100 } });

      // Act
      const result = await service.abrirCaja(event);

      // Assert
      expect(result).toEqual({ message: "Caja abierta correctamente", sesionId: "sesion_sesion-1", montoInicial: 100 });
      expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
        pk: "CAJA#2026-07-04",
        tipo: "CAJA_SESION",
        estado: "ABIERTA",
        montoInicial: 100
      }));
    });

    it("rechaza abrir una caja si ya hay una abierta", async () => {
      // Arrange
      const repository = createRepositoryMock({
        queryByPk: vi.fn().mockResolvedValue([{ tipo: "CAJA_SESION", estado: "ABIERTA" }])
      });
      const service = createPosService({
        repository,
        auditLog: vi.fn(),
        idGenerator: fixedId(),
        clock: fixedClock()
      });
      const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: {} });

      // Act
      const action = () => service.abrirCaja(event);

      // Assert
      await expect(action).rejects.toThrow("Ya existe una caja abierta para hoy");
    });

    it("cierra la caja calculando la diferencia contra lo esperado", async () => {
      // Arrange
      const repository = createRepositoryMock({
        queryByPk: vi.fn().mockResolvedValue([
          { tipo: "CAJA_SESION", estado: "ABIERTA", sesionId: "sesion-1", montoInicial: 100 },
          { tipo: "VENTA", metodoPago: "EFECTIVO", total: 30 },
          { tipo: "VENTA", metodoPago: "TARJETA", total: 50 }
        ])
      });
      const auditLog = vi.fn().mockResolvedValue(undefined);
      const service = createPosService({
        repository,
        auditLog,
        idGenerator: fixedId(),
        clock: fixedClock("2026-07-04T20:00:00.000Z")
      });
      const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: { montoContado: 125 } });

      // Act
      const result = await service.cerrarCaja(event);

      // Assert: esperado = 100 inicial + 30 efectivo = 130; contado 125 => diferencia -5
      expect(result).toEqual({ message: "Caja cerrada correctamente", montoEsperado: 130, montoContado: 125, diferencia: -5 });
      expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
        sesionId: "sesion-1",
        estado: "CERRADA",
        montoContado: 125,
        montoEsperado: 130,
        diferencia: -5
      }));
      expect(auditLog).toHaveBeenCalledWith(event, "CAJA_CERRAR", "OK", { sesionId: "sesion-1", diferencia: -5 });
    });

    it("rechaza cerrar caja si no hay ninguna abierta", async () => {
      // Arrange
      const repository = createRepositoryMock({ queryByPk: vi.fn().mockResolvedValue([]) });
      const service = createPosService({
        repository,
        auditLog: vi.fn(),
        idGenerator: fixedId(),
        clock: fixedClock()
      });
      const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: { montoContado: 100 } });

      // Act
      const action = () => service.cerrarCaja(event);

      // Assert
      await expect(action).rejects.toThrow("No hay una caja abierta para cerrar");
    });

    it("rechaza cerrar caja sin montoContado", async () => {
      // Arrange
      const service = createPosService({
        repository: createRepositoryMock(),
        auditLog: vi.fn(),
        idGenerator: fixedId(),
        clock: fixedClock()
      });
      const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: {} });

      // Act
      const action = () => service.cerrarCaja(event);

      // Assert
      await expect(action).rejects.toThrow("montoContado es obligatorio");
    });
  });
});
