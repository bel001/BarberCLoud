import { describe, expect, it, vi } from "vitest";
import { buildFinancialReport, createFinanceService } from "../../src/services/financeService.js";

describe("buildFinancialReport", () => {
  it("calcula total de reservas activas", () => {
    // Arrange
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "CLIENTE#3", estado: "CANCELADA", origen: "ONLINE", precio: 45 }
    ];

    // Act
    const report = buildFinancialReport(reservas);

    // Assert
    expect(report.totalReservas).toBe(2);
  });

  it("separa reservas online y presenciales", () => {
    // Arrange
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "CLIENTE#3", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 45 }
    ];

    // Act
    const report = buildFinancialReport(reservas);

    // Assert
    expect(report.online).toBe(1);
    expect(report.presenciales).toBe(2);
  });

  it("suma ingresos estimados ignorando canceladas y copias de agenda", () => {
    // Arrange
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CANCELADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "BARBERO#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 }
    ];

    // Act
    const report = buildFinancialReport(reservas);

    // Assert
    expect(report.ingresosEstimados).toBe(30);
  });

  it("suma cero cuando una reserva activa no tiene precio", () => {
    // Arrange
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE" }
    ];

    // Act
    const report = buildFinancialReport(reservas);

    // Assert
    expect(report.ingresosEstimados).toBe(0);
  });

  it("obtiene reporte desde repositorio inyectado", async () => {
    // Arrange
    const repository = {
      scanReservas: vi.fn().mockResolvedValue([
        { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 }
      ])
    };
    const service = createFinanceService({ repository });

    // Act
    const report = await service.getReport();

    // Assert
    expect(repository.scanReservas).toHaveBeenCalledTimes(1);
    expect(report).toEqual({
      totalReservas: 1,
      online: 1,
      presenciales: 0,
      ingresosEstimados: 30
    });
  });
});
