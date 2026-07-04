import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { publishReservationEvent } from "../lib/notifications.js";
import { created, ok, badRequest, serverError } from "../lib/response.js";
import { ServiceError, isConflictError } from "../services/errors.js";
import { createReservationService } from "../services/reservationService.js";

const tableName = process.env.TABLE_NAME || "barbercloud-local";

const reservationService = createReservationService({
  repository,
  auditLog: audit,
  publishReservationEvent,
  idGenerator: uuid,
  tableName
});

export function createGestionClientesHandler({ service, repository }) {
  return async function gestionClientesHandler(event) {
    try {
      requireRole(event, ["SECRETARIA", "ADMIN"]);

      const method = event.requestContext.http.method;
      const path = event.rawPath;

      if (method === "GET" && path.includes("/clientes")) {
        return ok({ clientes: await repository.scanByTipo("CLIENTE") });
      }

      if (method === "POST" && path.includes("/reservas-presenciales")) {
        return created(await service.createPresentialReservation(event));
      }

      return badRequest("Operacion no soportada");
    } catch (error) {
      if (error instanceof ServiceError) {
        return badRequest(error.message);
      }

      if (isConflictError(error)) {
        return badRequest("Horario no disponible");
      }

      return serverError(error);
    }
  };
}

export const handler = createGestionClientesHandler({ service: reservationService, repository });
