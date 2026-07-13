import { describe, expect, it } from "vitest";
import { validateOnlineReservationInput } from "../../src/services/reservationService.js";
import { validateSaleInput } from "../../src/services/posService.js";

// Pruebas de validacion: confirman que las reglas rechacen payloads
// incompletos antes de ejecutar logica de negocio.
describe("validaciones de servicios", () => {
  it("reserva falla si faltan campos obligatorios", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const body = { servicioId: "corte-clasico", fecha: "2026-07-10" };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const action = () => validateOnlineReservationInput(body);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(action).toThrow("servicioId, barberoId, fecha y hora son obligatorios");
  });

  it("POS falla si falta concepto o total", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const body = { concepto: "Corte clasico" };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const action = () => validateSaleInput(body);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(action).toThrow("concepto y total son obligatorios");
  });

  it("POS normaliza total numerico y metodo de pago por defecto", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const body = { concepto: "Corte clasico", total: "30" };

    // Ejecutar: llamar la funcion o handler bajo prueba
    const sale = validateSaleInput(body);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(sale).toEqual({
      concepto: "Corte clasico",
      total: 30,
      metodoPago: "EFECTIVO"
    });
  });
});
