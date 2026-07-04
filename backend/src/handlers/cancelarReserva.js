import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { publishReservationEvent } from "../lib/notifications.js";
import { ok, badRequest, serverError } from "../lib/response.js";
import { ServiceError } from "../services/errors.js";
import { createReservationService } from "../services/reservationService.js";

const tableName = process.env.TABLE_NAME || "barbercloud-local";

const reservationService = createReservationService({
  repository,
  auditLog: audit,
  publishReservationEvent,
  idGenerator: uuid,
  tableName
});

export function createCancelarReservaHandler(service) {
  return async function cancelarReservaHandler(event) {
    try {
      requireRole(event, ["CLIENTE"]);
      return ok(await service.cancelReservation(event));
    } catch (error) {
      if (error instanceof ServiceError) {
        return badRequest(error.message);
      }

      return serverError(error);
    }
  };
}

export const handler = createCancelarReservaHandler(reservationService);
