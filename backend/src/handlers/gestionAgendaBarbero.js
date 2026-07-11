import { getUser, hasRole, requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { ok, badRequest, serverError } from "../lib/response.js";
import { createAgendaBarberoService } from "../services/agendaBarberoService.js";
import { ServiceError } from "../services/errors.js";

const agendaBarberoService = createAgendaBarberoService({ repository, auditLog: audit });

export async function resolveBarberoId(event) {
  const user = getUser(event);
  const perfiles = await repository.scanByTipo("BARBERO");
  const perfil = perfiles.find(item => item.email === user.email);

  return perfil?.barberoId || user.sub || "barbero_carlos";
}

export async function handler(event) {
  try {
    requireRole(event, ["BARBERO", "ADMIN", "SECRETARIA"]);

    if (event.requestContext.http.method === "PUT" && !hasRole(event, ["ADMIN", "SECRETARIA"])) {
      const barberoId = await resolveBarberoId(event);
      return ok(await agendaBarberoService.updateTurnoStatus(event, barberoId));
    }

    const esVistaGlobal = hasRole(event, ["ADMIN", "SECRETARIA"]);
    const barberoId = esVistaGlobal ? null : await resolveBarberoId(event);
    const citas = esVistaGlobal ? await repository.scanReservas() : await repository.queryByPk(`BARBERO#${barberoId}`);
    const perfil = barberoId ? await repository.getItem(`BARBERO#${barberoId}`, "PROFILE") : null;

    return ok({
      citas: citas
        .filter(item => item.tipo === "RESERVA" && item.pk?.startsWith("BARBERO#"))
        .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`)),
      turnoEstado: perfil?.turnoEstado || "ACTIVO"
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}
