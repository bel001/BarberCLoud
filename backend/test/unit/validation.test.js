import { describe, expect, it } from "vitest";
import { validateOnlineReservationInput } from "../../src/services/reservationService.js";
import { validateSaleInput } from "../../src/services/posService.js";

describe("validaciones de servicios", () => {
  it("reserva falla si faltan campos obligatorios", () => {
    // Arrange
    const body = { servicioId: "corte-clasico", fecha: "2026-07-10" };

    // Act
    const action = () => validateOnlineReservationInput(body);

    // Assert
    expect(action).toThrow("servicioId, barberoId, fecha y hora son obligatorios");
  });

  it("POS falla si falta concepto o total", () => {
    // Arrange
    const body = { concepto: "Corte clasico" };

    // Act
    const action = () => validateSaleInput(body);

    // Assert
    expect(action).toThrow("concepto y total son obligatorios");
  });

  it("POS normaliza total numerico y metodo de pago por defecto", () => {
    // Arrange
    const body = { concepto: "Corte clasico", total: "30" };

    // Act
    const sale = validateSaleInput(body);

    // Assert
    expect(sale).toEqual({
      concepto: "Corte clasico",
      total: 30,
      metodoPago: "EFECTIVO"
    });
  });
});
