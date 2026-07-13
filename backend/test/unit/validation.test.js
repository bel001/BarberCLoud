import { describe, expect, it } from "vitest";
import { validateOnlineReservationInput } from "../../src/services/reservationService.js";
import { validateSaleInput } from "../../src/services/posService.js";

// Pruebas de validacion: confirman que las reglas rechacen payloads
// incompletos antes de ejecutar logica de negocio.
describe("validaciones de servicios", () => {
  it("reserva falla si faltan campos obligatorios", () => {
    const body = { servicioId: "corte-clasico", fecha: "2026-07-10" };

    const action = () => validateOnlineReservationInput(body);

    expect(action).toThrow("servicioId, barberoId, fecha y hora son obligatorios");
  });

  it("POS falla si falta concepto o total", () => {
    const body = { concepto: "Corte clasico" };

    const action = () => validateSaleInput(body);

    expect(action).toThrow("concepto y total son obligatorios");
  });

  it("POS normaliza total numerico y metodo de pago por defecto", () => {
    const body = { concepto: "Corte clasico", total: "30" };

    const sale = validateSaleInput(body);

    expect(sale).toEqual({
      concepto: "Corte clasico",
      total: 30,
      metodoPago: "EFECTIVO"
    });
  });
});
