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

  it("otorga puntos de lealtad al crear una reserva online", async () => {
    // Arrange
    const repository = createRepositoryMock({
      getItem: vi.fn((pk) => pk.startsWith("SERVICIO#")
        ? Promise.resolve({ nombre: "Corte clasico", precio: 30 })
        : Promise.resolve({ nombre: "Cliente Demo", email: "cliente@demo.local", puntos: 20 }))
    });
    const { service } = createService({ repository });
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
    await service.createOnlineReservation(event);

    // Assert
    expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CLIENTE#cliente-demo",
      sk: "PROFILE",
      tipo: "CLIENTE",
      puntos: 30
    }));
  });

  it("crea reserva online usando defaults si el servicio no existe", async () => {
    // Arrange
    const repository = createRepositoryMock({
      getItem: vi.fn().mockResolvedValue(undefined)
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({
      method: "POST",
      body: {
        servicioId: "servicio-desconocido",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    await service.createOnlineReservation(event);

    // Assert
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes[0].Put.Item).toMatchObject({
      servicioNombre: "servicio-desconocido",
      precio: 0
    });
  });

  it("rechaza reserva online con fecha y hora que ya paso", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({
      method: "POST",
      body: {
        servicioId: "corte-clasico",
        barberoId: "barbero_carlos",
        fecha: "2026-07-01",
        hora: "09:00"
      }
    });

    // Act
    const action = () => service.createOnlineReservation(event);

    // Assert
    await expect(action).rejects.toThrow("No se puede reservar en una fecha y hora que ya paso");
  });

  it("rechaza reserva online sin campos obligatorios", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", body: { servicioId: "corte-clasico" } });

    // Act
    const action = () => service.createOnlineReservation(event);

    // Assert
    await expect(action).rejects.toThrow("servicioId, barberoId, fecha y hora son obligatorios");
  });

  it("rechaza reserva online cuando el evento no trae body", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST" });

    // Act
    const action = () => service.createOnlineReservation(event);

    // Assert
    await expect(action).rejects.toThrow("servicioId, barberoId, fecha y hora son obligatorios");
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

  it("rechaza cancelacion sin reservaId", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST" });

    // Act
    const action = () => service.cancelReservation(event);

    // Assert
    await expect(action).rejects.toThrow("reservaId es obligatorio");
  });

  it("rechaza cancelacion si la reserva no pertenece al cliente", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([{ tipo: "RESERVA", reservaId: "otra" }])
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" } });

    // Act
    const action = () => service.cancelReservation(event);

    // Assert
    await expect(action).rejects.toThrow("Reserva no encontrada para este cliente");
  });

  it("rechaza cancelacion si la reserva ya estaba cancelada", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([
        { tipo: "RESERVA", reservaId: "res_123", estado: "CANCELADA" }
      ])
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" } });

    // Act
    const action = () => service.cancelReservation(event);

    // Assert
    await expect(action).rejects.toThrow("La reserva ya se encuentra cancelada");
  });

  it("cancela reserva sin copia de agenda cuando no tiene barbero", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([
        {
          tipo: "RESERVA",
          reservaId: "res_123",
          pk: "CLIENTE#cliente-demo",
          sk: "RESERVA#2026-07-10#10:00",
          fecha: "2026-07-10",
          hora: "10:00",
          estado: "CONFIRMADA"
        }
      ])
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" } });

    // Act
    await service.cancelReservation(event);

    // Assert
    expect(repository.transactWrite.mock.calls[0][0]).toHaveLength(1);
  });

  it("reprograma una reserva a nueva fecha y hora", async () => {
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
    const event = lambdaEvent({
      method: "POST",
      pathParameters: { id: "res_123" },
      body: { fecha: "2026-07-11", hora: "15:00" }
    });

    // Act
    const result = await service.rescheduleReservation(event);

    // Assert
    expect(result).toEqual({ message: "Reserva reprogramada correctamente", reservaId: "res_123" });
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes).toHaveLength(4);
    expect(writes[0].Put.Item).toMatchObject({ pk: "CLIENTE#cliente-demo", sk: "RESERVA#2026-07-10#10:00", estado: "CANCELADA" });
    expect(writes[1].Put.Item).toMatchObject({ pk: "CLIENTE#cliente-demo", sk: "RESERVA#2026-07-11#15:00", estado: "CONFIRMADA", fecha: "2026-07-11", hora: "15:00" });
    expect(writes[2].Put.Item).toMatchObject({ pk: "BARBERO#barbero_carlos", sk: "RESERVA#2026-07-10#10:00", estado: "CANCELADA" });
    expect(writes[3].Put.Item).toMatchObject({ pk: "BARBERO#barbero_carlos", sk: "RESERVA#2026-07-11#15:00", estado: "CONFIRMADA" });
    expect(publishReservationEvent).toHaveBeenCalledWith("RESERVA_REPROGRAMADA", expect.objectContaining({ reservaId: "res_123", fecha: "2026-07-11", hora: "15:00" }));
  });

  it("rechaza reprogramar a la misma fecha y hora", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([
        { tipo: "RESERVA", reservaId: "res_123", fecha: "2026-07-10", hora: "10:00", estado: "CONFIRMADA" }
      ])
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" }, body: { fecha: "2026-07-10", hora: "10:00" } });

    // Act
    const action = () => service.rescheduleReservation(event);

    // Assert
    await expect(action).rejects.toThrow("La nueva fecha y hora deben ser distintas a la actual");
  });

  it("rechaza reprogramar a una fecha y hora que ya paso", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" }, body: { fecha: "2026-07-01", hora: "09:00" } });

    // Act
    const action = () => service.rescheduleReservation(event);

    // Assert
    await expect(action).rejects.toThrow("No se puede reservar en una fecha y hora que ya paso");
  });

  it("rechaza reprogramar una reserva inexistente", async () => {
    // Arrange
    const repository = createRepositoryMock({ queryByPk: vi.fn().mockResolvedValue([]) });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" }, body: { fecha: "2026-07-11", hora: "15:00" } });

    // Act
    const action = () => service.rescheduleReservation(event);

    // Assert
    await expect(action).rejects.toThrow("Reserva no encontrada para este cliente");
  });

  it("rechaza reprogramar una reserva ya cancelada", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([
        { tipo: "RESERVA", reservaId: "res_123", fecha: "2026-07-10", hora: "10:00", estado: "CANCELADA" }
      ])
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" }, body: { fecha: "2026-07-11", hora: "15:00" } });

    // Act
    const action = () => service.rescheduleReservation(event);

    // Assert
    await expect(action).rejects.toThrow("La reserva ya se encuentra cancelada");
  });

  it("rechaza reprogramar sin fecha y hora", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_123" }, body: {} });

    // Act
    const action = () => service.rescheduleReservation(event);

    // Assert
    await expect(action).rejects.toThrow("fecha y hora son obligatorios");
  });

  it("rechaza reprogramar sin reservaId", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", body: { fecha: "2026-07-11", hora: "15:00" } });

    // Act
    const action = () => service.rescheduleReservation(event);

    // Assert
    await expect(action).rejects.toThrow("reservaId es obligatorio");
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

  it("secretaria crea cita presencial con defaults de servicio", async () => {
    // Arrange
    const repository = createRepositoryMock({
      findClienteByEmail: vi.fn().mockResolvedValue({
        clienteId: "cliente-uno",
        nombre: "Cliente Uno",
        email: "cliente@demo.local"
      }),
      queryByPk: vi.fn().mockResolvedValue([{ fecha: "2026-07-10", hora: "10:00", estado: "CANCELADA" }]),
      getItem: vi.fn().mockResolvedValue(undefined)
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      user: { email: "secretaria@demo.local", sub: "secretaria-uno" },
      body: {
        clienteCorreo: "cliente@demo.local",
        servicioId: "servicio-desconocido",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    await service.createPresentialReservation(event);

    // Assert
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes[0].Put.Item).toMatchObject({
      servicioNombre: "servicio-desconocido",
      precio: 0
    });
  });

  it("rechaza cita presencial sin campos obligatorios", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: { clienteCorreo: "cliente@demo.local" } });

    // Act
    const action = () => service.createPresentialReservation(event);

    // Assert
    await expect(action).rejects.toThrow("clienteCorreo, servicioId, barberoId, fecha y hora son obligatorios");
  });

  it("rechaza cita presencial cuando el evento no trae body", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", role: "SECRETARIA" });

    // Act
    const action = () => service.createPresentialReservation(event);

    // Assert
    await expect(action).rejects.toThrow("clienteCorreo, servicioId, barberoId, fecha y hora son obligatorios");
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

  it("permite usar reloj real cuando no se inyecta clock", async () => {
    // Arrange
    const repository = createRepositoryMock({
      getItem: vi.fn().mockResolvedValue({ nombre: "Corte", precio: 30 })
    });
    const service = createReservationService({
      repository,
      auditLog: vi.fn().mockResolvedValue(undefined),
      publishReservationEvent: vi.fn().mockResolvedValue(undefined),
      idGenerator: fixedId(),
      tableName: "barbercloud-test"
    });
    const event = lambdaEvent({
      method: "POST",
      body: {
        servicioId: "corte",
        barberoId: "barbero_carlos",
        fecha: "2026-07-10",
        hora: "10:00"
      }
    });

    // Act
    await service.createOnlineReservation(event);

    // Assert
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes[0].Put.Item.creadoEn).toEqual(expect.any(String));
  });
});
