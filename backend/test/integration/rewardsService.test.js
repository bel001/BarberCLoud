import { describe, expect, it, vi } from "vitest";
import { createRewardsService, CATALOGO_RECOMPENSAS } from "../../src/services/rewardsService.js";
import { lambdaEvent, parseBody } from "../helpers/events.js";
import { createRepositoryMock, fixedClock, fixedId } from "../helpers/mocks.js";
import { createGestionRecompensasHandler } from "../../src/handlers/gestionRecompensas.js";

function createService(overrides = {}) {
  const repository = overrides.repository || createRepositoryMock();
  const auditLog = overrides.auditLog || vi.fn().mockResolvedValue(undefined);
  const service = createRewardsService({
    repository,
    auditLog,
    idGenerator: fixedId("abcdef1234567890"),
    clock: fixedClock()
  });

  return { service, repository, auditLog };
}

describe("rewardsService", () => {
  it("canjea una recompensa cuando el cliente tiene puntos suficientes", async () => {
    // Arrange
    const repository = createRepositoryMock({
      getItem: vi.fn().mockResolvedValue({ nombre: "Cliente Demo", email: "cliente@demo.local", puntos: 150 })
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", user: { sub: "cliente-demo" }, body: { recompensaId: "barba-gratis" } });

    // Act
    const result = await service.redeemReward(event);

    // Assert
    expect(result.message).toBe("Recompensa canjeada correctamente");
    expect(result.puntosRestantes).toBe(50);
    expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CLIENTE#cliente-demo",
      sk: "PROFILE",
      puntos: 50
    }));
    expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CLIENTE#cliente-demo",
      tipo: "CANJE",
      recompensaId: "barba-gratis",
      puntosUsados: 100
    }));
  });

  it("rechaza el canje si no hay puntos suficientes", async () => {
    // Arrange
    const repository = createRepositoryMock({
      getItem: vi.fn().mockResolvedValue({ puntos: 20 })
    });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", user: { sub: "cliente-demo" }, body: { recompensaId: "barba-gratis" } });

    // Act
    const action = () => service.redeemReward(event);

    // Assert
    await expect(action).rejects.toThrow("No tienes suficientes puntos para esta recompensa");
  });

  it("rechaza el canje de una recompensa inexistente", async () => {
    // Arrange
    const { service } = createService();
    const event = lambdaEvent({ method: "POST", user: { sub: "cliente-demo" }, body: { recompensaId: "no-existe" } });

    // Act
    const action = () => service.redeemReward(event);

    // Assert
    await expect(action).rejects.toThrow("Recompensa no encontrada");
  });

  it("cliente sin perfil aun tiene 0 puntos y no puede canjear", async () => {
    // Arrange
    const repository = createRepositoryMock({ getItem: vi.fn().mockResolvedValue(null) });
    const { service } = createService({ repository });
    const event = lambdaEvent({ method: "POST", user: { sub: "cliente-nuevo" }, body: { recompensaId: "barba-gratis" } });

    // Act
    const action = () => service.redeemReward(event);

    // Assert
    await expect(action).rejects.toThrow("No tienes suficientes puntos para esta recompensa");
  });

  it("el handler GET expone el catalogo de recompensas", async () => {
    // Arrange
    const handler = createGestionRecompensasHandler(createService().service);
    const event = lambdaEvent({ method: "GET" });

    // Act
    const response = await handler(event);

    // Assert
    expect(parseBody(response)).toEqual({ catalogo: CATALOGO_RECOMPENSAS });
  });

  it("el handler POST rechaza recompensas con datos invalidos como error 400", async () => {
    // Arrange
    const handler = createGestionRecompensasHandler(createService().service);
    const event = lambdaEvent({ method: "POST", body: { recompensaId: "no-existe" } });

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Recompensa no encontrada" });
  });
});
