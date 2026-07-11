import { hasRole, requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { ok, badRequest, serverError } from "../lib/response.js";
import { createAgendaBarberoService } from "../services/agendaBarberoService.js";
import { ServiceError } from "../services/errors.js";
import { resolveBarberoId } from "./gestionAgendaBarbero.js";

const agendaBarberoService = createAgendaBarberoService({ repository, auditLog: audit });

export async function handler(event) {
  try {
    requireRole(event, ["BARBERO", "ADMIN"]);

    const body = JSON.parse(event.body || "{}");
    // El administrador puede intervenir en la cita de cualquier barbero indicando barberoId;
    // el barbero solo puede actuar sobre su propia agenda.
    const barberoId = hasRole(event, ["ADMIN"]) && body.barberoId
      ? body.barberoId
      : await resolveBarberoId(event);

    return ok(await agendaBarberoService.updateReservationStatus(event, barberoId));
  } catch (error) {
    if (error instanceof ServiceError) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}
