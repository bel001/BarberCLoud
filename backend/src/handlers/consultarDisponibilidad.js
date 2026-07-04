import * as repository from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";
import { createAvailabilityService } from "../services/availabilityService.js";

const availabilityService = createAvailabilityService({ repository });

export function createConsultarDisponibilidadHandler(service) {
  return async function consultarDisponibilidadHandler(event = {}) {
    try {
      return ok(await service.getAvailability(event));
    } catch (error) {
      return serverError(error);
    }
  };
}

export const handler = createConsultarDisponibilidadHandler(availabilityService);
