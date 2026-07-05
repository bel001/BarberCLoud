import { getUser, hasRole, requireRole } from "../lib/auth.js";
import { queryByPk, scanByTipo, scanReservas } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["BARBERO", "ADMIN"]);

    const citas = hasRole(event, ["ADMIN"])
      ? await scanReservas()
      : await getAgendaBarbero(event);

    return ok({
      citas: citas
        .filter(item => item.tipo === "RESERVA" && item.pk?.startsWith("BARBERO#"))
        .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    });
  } catch (error) {
    return serverError(error);
  }
}

async function getAgendaBarbero(event) {
  const user = getUser(event);
  const perfiles = await scanByTipo("BARBERO");
  const perfil = perfiles.find(item => item.email === user.email);
  const barberoId = perfil?.barberoId || user.sub || "barbero_carlos";

  return queryByPk(`BARBERO#${barberoId}`);
}
