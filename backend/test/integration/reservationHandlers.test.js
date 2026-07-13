import { describe, expect, it, vi } from "vitest";
import { createNuevaReservaHandler } from "../../src/handlers/nuevaReserva.js";
import { createCancelarReservaHandler } from "../../src/handlers/cancelarReserva.js";
import { createReprogramarReservaHandler } from "../../src/handlers/reprogramarReserva.js";
import { ServiceError } from "../../src/services/errors.js";
import { lambdaEvent, parseBody } from "../helpers/events.js";

const invalidIdentity = new ServiceError("Identidad de cliente no valida", 401);

const cases = [
  {
    name: "crear",
    handler: () => createNuevaReservaHandler({
      createOnlineReservation: vi.fn().mockRejectedValue(invalidIdentity)
    }),
    event: () => lambdaEvent({ method: "POST", role: "CLIENTE", body: {} })
  },
  {
    name: "cancelar",
    handler: () => createCancelarReservaHandler({
      cancelReservation: vi.fn().mockRejectedValue(invalidIdentity)
    }),
    event: () => lambdaEvent({ method: "POST", role: "CLIENTE", pathParameters: { reservaId: "reserva_1" } })
  },
  {
    name: "reprogramar",
    handler: () => createReprogramarReservaHandler({
      rescheduleReservation: vi.fn().mockRejectedValue(invalidIdentity)
    }),
    event: () => lambdaEvent({ method: "POST", role: "CLIENTE", pathParameters: { reservaId: "reserva_1" }, body: {} })
  }
];

describe("handlers de reservas", () => {
  it.each(cases)("conserva el estado 401 al $name sin identidad valida", async ({ handler, event }) => {
    const response = await handler()(event());

    expect(response.statusCode).toBe(401);
    expect(parseBody(response)).toEqual({ error: "Identidad de cliente no valida" });
  });
});
