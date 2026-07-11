import { ServiceError } from "./errors.js";

export const CONFIG_NEGOCIO_DEFAULT = {
  comisionPorcentaje: 40,
  penalizacionPorcentaje: 20,
  horasParaPenalizacion: 3,
  anticipacionMinimaHoras: 1,
  anticipacionMaximaDias: 30
};

export function createBusinessConfigService({ repository, auditLog }) {
  return {
    async getConfig() {
      const config = await repository.getItem("CONFIG#NEGOCIO", "PROFILE");
      return { ...CONFIG_NEGOCIO_DEFAULT, ...(config || {}) };
    },

    async updateConfig(event) {
      const body = JSON.parse(event.body || "{}");
      const {
        comisionPorcentaje,
        penalizacionPorcentaje,
        horasParaPenalizacion,
        anticipacionMinimaHoras,
        anticipacionMaximaDias
      } = body;

      const valores = { comisionPorcentaje, penalizacionPorcentaje, horasParaPenalizacion, anticipacionMinimaHoras, anticipacionMaximaDias };

      Object.entries(valores).forEach(([campo, valor]) => {
        if (valor === undefined || valor === null) return;
        if (Number.isNaN(Number(valor)) || Number(valor) < 0) {
          throw new ServiceError(`${campo} debe ser un numero valido mayor o igual a 0`);
        }
      });

      const camposEnviados = Object.fromEntries(
        Object.entries(valores).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, Number(v)])
      );

      const actual = await repository.getItem("CONFIG#NEGOCIO", "PROFILE");

      const nuevaConfig = {
        pk: "CONFIG#NEGOCIO",
        sk: "PROFILE",
        tipo: "CONFIG_NEGOCIO",
        ...CONFIG_NEGOCIO_DEFAULT,
        ...(actual || {}),
        ...camposEnviados,
        actualizadoEn: new Date().toISOString()
      };

      await repository.putItem(nuevaConfig);
      await auditLog(event, "NEGOCIO_CONFIG_ACTUALIZAR", "OK", camposEnviados);

      return { message: "Configuración del negocio actualizada", config: nuevaConfig };
    }
  };
}
