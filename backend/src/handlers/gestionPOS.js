import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import * as repository from "../lib/dynamodb.js";
import { created, ok, badRequest, serverError } from "../lib/response.js";
import { ServiceError } from "../services/errors.js";
import { createPosService } from "../services/posService.js";

const posService = createPosService({
  repository,
  auditLog: audit,
  idGenerator: uuid
});

export function createGestionPOSHandler(service) {
  return async function gestionPOSHandler(event) {
    try {
      requireRole(event, ["SECRETARIA", "ADMIN"]);

      const method = event.requestContext.http.method;

      if (method === "POST") {
        return created(await service.registerSale(event));
      }

      return ok(await service.listSales());
    } catch (error) {
      if (error instanceof ServiceError) {
        return badRequest(error.message);
      }

      return serverError(error);
    }
  };
}

export const handler = createGestionPOSHandler(posService);
