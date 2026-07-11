import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { ok, badRequest, serverError } from "../lib/response.js";
import { ServiceError } from "../services/errors.js";
import { createRewardsService, CATALOGO_RECOMPENSAS } from "../services/rewardsService.js";

const rewardsService = createRewardsService({
  repository,
  auditLog: audit,
  idGenerator: uuid
});

export function createGestionRecompensasHandler(service) {
  return async function gestionRecompensasHandler(event) {
    try {
      requireRole(event, ["CLIENTE"]);

      const method = event.requestContext.http.method;

      if (method === "POST") {
        return ok(await service.redeemReward(event));
      }

      return ok({ catalogo: CATALOGO_RECOMPENSAS });
    } catch (error) {
      if (error instanceof ServiceError) {
        return badRequest(error.message);
      }

      return serverError(error);
    }
  };
}

export const handler = createGestionRecompensasHandler(rewardsService);
