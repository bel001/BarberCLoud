import { describe, expect, it, vi } from "vitest";
import { createNuevaReservaHandler } from "../../src/handlers/nuevaReserva.js";
import { createReservationService } from "../../src/services/reservationService.js";
import { lambdaEvent, parseBody } from "../helpers/events.js";
import { createRepositoryMock, fixedClock, fixedId } from "../helpers/mocks.js";

function createService(overrides = {}) {
  const repository = overrides.repository || createRepositoryMock({
    getItem: vi.fn().mockResolvedValue({ nombre: "Corte clasico", precio: 30 })
  });
  const auditLog = overrides.auditLog || vi.fn().mockResolvedValue(undefined);
  const publishReservationEvent = overrides.publishReservationEvent || vi.fn().mockResolvedValue(undefined);
  const service = createReservationService({
    repository,
    auditLog,
    publishReservationEvent,
    idGenerator: fixedId(),
    clock: fixedClock(),
    tableName: "barbercloud-test"
  });

  return { service, repository, auditLog, publishReservationEvent };
}

describe("reservationService integration con mocks", () => {
  it("crea reserva online para cliente y agenda de barbero", async () => {
    // Arrange
    const { service, repository, publishReservationEvent } = createService();
    const event = lambdaEvent({
      method: "POST",
      body: {
        servicioId: "corte-clasico",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    const result = await service.createOnlineReservation(event);

    // Assert
    expect(result).toEqual({
      message: "Reserva creada correctamente",
      reservaId: "res_test-id"
    });
    expect(repository.transactWrite).toHaveBeenCalledTimes(1);
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes).toHaveLength(2);
    expect(writes[0].Put.Item.pk).toBe("CLIENTE#cliente-demo");
    expect(writes[1].Put.Item.pk).toBe("BARBERO#barbero_carlos");
    expect(publishReservationEvent).toHaveBeenCalledWith("RESERVA_CREADA", expect.objectContaining({
      reservaId: "res_test-id",
      origen: "ONLINE"
    }));
  });

  it("responde horario no disponible si DynamoDB simula conflicto", async () => {
    // Arrange
    const repository = createRepositoryMock({
      getItem: vi.fn().mockResolvedValue({ nombre: "Corte clasico", precio: 30 }),
      transactWrite: vi.fn().mockRejectedValue({ name: "TransactionCanceledException" })
    });
    const { service } = createService({ repository });
    const handler = createNuevaReservaHandler(service);
    const event = lambdaEvent({
      method: "POST",
      body: {
        servicioId: "corte-clasico",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Horario no disponible" });
  });

  it("cancela reserva del cliente y publica evento de cancelacion", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([
        {
          tipo: "RESERVA",
          reservaId: "res_123",
          pk: "CLIENTE#cliente-demo",
          sk: "RESERVA#2026-07-10#10:00",
          barberoId: "barbero_carlos",
          fecha: "2026-07-10",
          hora: "10:00",
          estado: "CONFIRMADA"
        }
      ])
    });
    const { service, publishReservationEvent } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" } });

    // Act
    const result = await service.cancelReservation(event);

    // Assert
    expect(result).toEqual({
      message: "Reserva cancelada correctamente",
      reservaId: "res_123"
    });
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes[0].Put.Item.estado).toBe("CANCELADA");
    expect(writes[1].Put.Item.pk).toBe("BARBERO#barbero_carlos");
    expect(publishReservationEvent).toHaveBeenCalledWith("RESERVA_CANCELADA", expect.objectContaining({
      reservaId: "res_123",
      estado: "CANCELADA"
    }));
  });

  it("secretaria crea cita presencial para cliente existente", async () => {
    // Arrange
    const repository = createRepositoryMock({
      findClienteByEmail: vi.fn().mockResolvedValue({
        clienteId: "cliente-uno",
        nombre: "Cliente Uno",
        email: "cliente@demo.local"
      }),
      queryByPk: vi.fn().mockResolvedValue([]),
      getItem: vi.fn().mockResolvedValue({ nombre: "Corte clasico", precio: 30 })
    });
    const { service, publishReservationEvent } = createService({ repository });
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      user: { email: "secretaria@demo.local", sub: "secretaria-uno" },
      body: {
        clienteCorreo: "cliente@demo.local",
        servicioId: "corte-clasico",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    const result = await service.createPresentialReservation(event);

    // Assert
    expect(result).toEqual({
      message: "Cita presencial registrada para cliente existente",
      reservaId: "res_test-id",
      clienteId: "cliente-uno"
    });
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes[0].Put.Item.origen).toBe("PRESENCIAL");
    expect(writes[0].Put.Item.creadoPor).toBe("secretaria@demo.local");
    expect(publishReservationEvent).toHaveBeenCalledWith("RESERVA_CREADA", expect.objectContaining({
      origen: "PRESENCIAL"
    }));
  });

  it("secretaria falla si el cliente no existe", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      body: {
        clienteCorreo: "nuevo@demo.local",
        servicioId: "corte-clasico",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    const action = () => service.createPresentialReservation(event);

    // Assert
    await expect(action).rejects.toThrow("El cliente no esta registrado");
  });

  it("secretaria falla si el horario ya esta ocupado", async () => {
    // Arrange
    const repository = createRepositoryMock({
      findClienteByEmail: vi.fn().mockResolvedValue({
        clienteId: "cliente-uno",
        nombre: "Cliente Uno",
        email: "cliente@demo.local"
      }),
      queryByPk: vi.fn().mockResolvedValue([
        { fecha: "2026-07-10", hora: "10:00", estado: "CONFIRMADA" }
      ])
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      body: {
        clienteCorreo: "cliente@demo.local",
        servicioId: "corte-clasico",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    const action = () => service.createPresentialReservation(event);

    // Assert
    await expect(action).rejects.toThrow("Horario no disponible");
  });
});
