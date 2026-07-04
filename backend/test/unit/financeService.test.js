import { describe, expect, it } from "vitest";
import { buildFinancialReport } from "../../src/services/financeService.js";

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
});
