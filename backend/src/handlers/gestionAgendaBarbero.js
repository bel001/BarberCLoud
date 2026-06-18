import { getUser, requireRole } from "../lib/auth.js";
import { queryByPk } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["BARBERO", "ADMIN"]);

    const user = getUser(event);
    const barberoId = user.sub || "barbero_carlos";
    const citas = await queryByPk(`BARBERO#${barberoId}`);

    return ok({
      citas: citas
        .filter(item => item.tipo === "RESERVA")
        .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    });
  } catch (error) {
    return serverError(error);
  }
}
