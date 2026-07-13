import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { publishReservationEvent } from "../lib/notifications.js";
import { ok, badRequest, serverError } from "../lib/response.js";
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

export function createReprogramarReservaHandler(service) {
  return async function reprogramarReservaHandler(event) {
    try {
      requireRole(event, ["CLIENTE"]);
      return ok(await service.rescheduleReservation(event));
    } catch (error) {
      if (error instanceof ServiceError) {
        return serverError(error);
      }

      if (isConflictError(error)) {
        return badRequest("Horario no disponible");
      }

      return serverError(error);
    }
  };
}

export const handler = createReprogramarReservaHandler(reservationService);
