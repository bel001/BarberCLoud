import { requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { ok, badRequest, serverError } from "../lib/response.js";
import { ServiceError } from "../services/errors.js";
import { createBusinessConfigService } from "../services/businessConfigService.js";

const businessConfigService = createBusinessConfigService({ repository, auditLog: audit });

export function createGestionConfigNegocioHandler(service) {
  return async function gestionConfigNegocioHandler(event) {
    try {
      requireRole(event, ["ADMIN"]);

      if (event.requestContext.http.method === "PUT") {
        return ok(await service.updateConfig(event));
      }

      return ok(await service.getConfig());
    } catch (error) {
      if (error instanceof ServiceError) {
        return badRequest(error.message);
      }

      return serverError(error);
    }
  };
}

export const handler = createGestionConfigNegocioHandler(businessConfigService);
