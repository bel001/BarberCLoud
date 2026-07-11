import { describe, expect, it, vi } from "vitest";
import { createAgendaBarberoService } from "../../src/services/agendaBarberoService.js";
import { lambdaEvent } from "../helpers/events.js";
import { createRepositoryMock, fixedClock } from "../helpers/mocks.js";

function createService(overrides = {}) {
  const repository = overrides.repository || createRepositoryMock();
  const auditLog = overrides.auditLog || vi.fn().mockResolvedValue(undefined);
  const service = createAgendaBarberoService({
    repository,
    auditLog,
    clock: fixedClock(),
    tableName: "barbercloud-test"
  });

  return { service, repository, auditLog };
}

describe("agendaBarberoService", () => {
  it("actualiza el estado de una cita y su copia del lado del cliente", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([
        {
          tipo: "RESERVA",
          reservaId: "res_1",
          pk: "BARBERO#barbero_carlos",
          sk: "RESERVA#2026-07-10#10:00",
          clienteId: "cliente-demo",
          estado: "CONFIRMADA"
        }
      ])
    });
    const { service, auditLog } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_1" }, body: { estado: "EN_PROCESO" } });

    // Act
    const result = await service.updateReservationStatus(event, "barbero_carlos");

    // Assert
    expect(result).toEqual({ message: "Estado actualizado correctamente", reservaId: "res_1", estado: "EN_PROCESO" });
    const writes = repository.transactWrite.mock.calls[0][0];
    expect(writes).toHaveLength(2);
    expect(writes[0].Put.Item).toMatchObject({ pk: "BARBERO#barbero_carlos", estado: "EN_PROCESO" });
    expect(writes[1].Put.Item).toMatchObject({ pk: "CLIENTE#cliente-demo", sk: "RESERVA#2026-07-10#10:00", estado: "EN_PROCESO" });
    expect(auditLog).toHaveBeenCalled();
  });

  it("rechaza un estado invalido", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_1" }, body: { estado: "LO_QUE_SEA" } });

    // Act
    const action = () => service.updateReservationStatus(event, "barbero_carlos");

    // Assert
    await expect(action).rejects.toThrow("estado debe ser uno de");
  });

  it("rechaza actualizar una cita que no existe para ese barbero", async () => {
    // Arrange
    const repository = createRepositoryMock({ queryByPk: vi.fn().mockResolvedValue([]) });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_1" }, body: { estado: "FINALIZADO" } });

    // Act
    const action = () => service.updateReservationStatus(event, "barbero_carlos");

    // Assert
    await expect(action).rejects.toThrow("Cita no encontrada para este barbero");
  });

  it("rechaza modificar una cita ya finalizada o cancelada", async () => {
    // Arrange
    const repository = createRepositoryMock({
      queryByPk: vi.fn().mockResolvedValue([{ tipo: "RESERVA", reservaId: "res_1", estado: "CANCELADA" }])
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_1" }, body: { estado: "FINALIZADO" } });

    // Act
    const action = () => service.updateReservationStatus(event, "barbero_carlos");

    // Assert
    await expect(action).rejects.toThrow("No se puede modificar una cita en estado CANCELADA");
  });

  it("actualiza el estado del turno del barbero", async () => {
    // Arrange
    const repository = createRepositoryMock({ getItem: vi.fn().mockResolvedValue({ nombre: "Carlos Barbero" }) });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "PUT", body: { turnoEstado: "DESCANSO" } });

    // Act
    const result = await service.updateTurnoStatus(event, "barbero_carlos");

    // Assert
    expect(result).toEqual({ message: "Turno actualizado correctamente", turnoEstado: "DESCANSO" });
    expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "BARBERO#barbero_carlos",
      sk: "PROFILE",
      turnoEstado: "DESCANSO"
    }));
  });

  it("rechaza un turnoEstado invalido", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "PUT", body: { turnoEstado: "LO_QUE_SEA" } });

    // Act
    const action = () => service.updateTurnoStatus(event, "barbero_carlos");

    // Assert
    await expect(action).rejects.toThrow("turnoEstado debe ser uno de");
  });
});
