import { describe, expect, it, vi } from "vitest";
import { createBusinessConfigService, CONFIG_NEGOCIO_DEFAULT } from "../../src/services/businessConfigService.js";
import { lambdaEvent } from "../helpers/events.js";
import { createRepositoryMock } from "../helpers/mocks.js";

function createService(overrides = {}) {
  const repository = overrides.repository || createRepositoryMock();
  const auditLog = overrides.auditLog || vi.fn().mockResolvedValue(undefined);
  const service = createBusinessConfigService({ repository, auditLog });
  return { service, repository, auditLog };
}

describe("businessConfigService", () => {
  it("devuelve los valores por defecto si no hay configuracion guardada", async () => {
    const { service } = createService();

    const config = await service.getConfig();

    expect(config).toEqual(CONFIG_NEGOCIO_DEFAULT);
  });

  it("combina la configuracion guardada con los valores por defecto", async () => {
    const repository = createRepositoryMock({
      getItem: vi.fn().mockResolvedValue({ comisionPorcentaje: 50 })
    });
    const { service } = createService({ repository });

    const config = await service.getConfig();

    expect(config.comisionPorcentaje).toBe(50);
    expect(config.penalizacionPorcentaje).toBe(CONFIG_NEGOCIO_DEFAULT.penalizacionPorcentaje);
  });

  it("actualiza solo los campos enviados preservando el resto", async () => {
    const repository = createRepositoryMock({
      getItem: vi.fn().mockResolvedValue({ comisionPorcentaje: 50, penalizacionPorcentaje: 25 })
    });
    const { service, repository: repo, auditLog } = createService({ repository });
    const event = lambdaEvent({ method: "PUT", role: "ADMIN", body: { comisionPorcentaje: 45 } });

    const result = await service.updateConfig(event);

    expect(result.config.comisionPorcentaje).toBe(45);
    expect(result.config.penalizacionPorcentaje).toBe(25);
    expect(repo.putItem).toHaveBeenCalledWith(expect.objectContaining({ pk: "CONFIG#NEGOCIO", comisionPorcentaje: 45 }));
    expect(auditLog).toHaveBeenCalled();
  });

  it("rechaza valores negativos o invalidos", async () => {
    const { service } = createService();
    const event = lambdaEvent({ method: "PUT", role: "ADMIN", body: { comisionPorcentaje: -10 } });

    const action = () => service.updateConfig(event);

    await expect(action).rejects.toThrow("comisionPorcentaje debe ser un numero valido mayor o igual a 0");
  });
});
