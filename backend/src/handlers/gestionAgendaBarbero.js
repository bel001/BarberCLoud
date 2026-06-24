import { getUser, hasRole, requireRole } from "../lib/auth.js";
import { queryByPk, scanReservas } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["BARBERO", "ADMIN"]);

    const citas = hasRole(event, ["ADMIN"])
      ? await scanReservas()
      : await queryByPk(`BARBERO#${getUser(event).sub || "barbero_carlos"}`);

    return ok({
      citas: citas
        .filter(item => item.tipo === "RESERVA" && item.pk?.startsWith("BARBERO#"))
        .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    });
  } catch (error) {
    return serverError(error);
  }
}
