import { getUser } from "../lib/auth.js";
import { ServiceError } from "./errors.js";

export const CATALOGO_RECOMPENSAS = [
  { id: "barba-gratis", nombre: "Perfilado de barba gratis", puntos: 100 },
  { id: "corte-clasico-gratis", nombre: "Corte clásico gratis", puntos: 150 },
  { id: "corte-barba-gratis", nombre: "Corte y barba gratis", puntos: 200 }
];

function generarCodigo(idGenerator) {
  return `CANJE-${String(idGenerator()).slice(0, 8).toUpperCase()}`;
}

export function createRewardsService({ repository, auditLog, idGenerator, clock = () => new Date() }) {
  return {
    async redeemReward(event) {
      const user = getUser(event);
      const body = JSON.parse(event.body || "{}");
      const { recompensaId } = body;

      const recompensa = CATALOGO_RECOMPENSAS.find(item => item.id === recompensaId);

      if (!recompensa) {
        throw new ServiceError("Recompensa no encontrada");
      }

      const perfil = await repository.getItem(`CLIENTE#${user.sub}`, "PROFILE");
      const puntosActuales = perfil?.puntos || 0;

      if (puntosActuales < recompensa.puntos) {
        throw new ServiceError("No tienes suficientes puntos para esta recompensa");
      }

      const codigo = generarCodigo(idGenerator);
      const now = clock().toISOString();

      await repository.putItem({
        ...perfil,
        pk: `CLIENTE#${user.sub}`,
        sk: "PROFILE",
        tipo: "CLIENTE",
        clienteId: user.sub,
        puntos: puntosActuales - recompensa.puntos
      });

      await repository.putItem({
        pk: `CLIENTE#${user.sub}`,
        sk: `CANJE#${now}`,
        tipo: "CANJE",
        recompensaId: recompensa.id,
        recompensaNombre: recompensa.nombre,
        puntosUsados: recompensa.puntos,
        codigo,
        creadoEn: now
      });

      await auditLog(event, "RECOMPENSA_CANJEAR", "OK", { recompensaId, codigo });

      return {
        message: "Recompensa canjeada correctamente",
        codigo,
        puntosRestantes: puntosActuales - recompensa.puntos
      };
    }
  };
}
