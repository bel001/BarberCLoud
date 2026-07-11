import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import * as repository from "../lib/dynamodb.js";
import { created, badRequest, serverError } from "../lib/response.js";
import { ServiceError } from "../services/errors.js";
import { createPosService } from "../services/posService.js";

const posService = createPosService({
  repository,
  auditLog: audit,
  idGenerator: uuid
});

export function createGestionCajaHandler(service) {
  return async function gestionCajaHandler(event) {
    try {
      requireRole(event, ["SECRETARIA", "ADMIN"]);

      const path = event.rawPath || "";

      if (path.includes("/cerrar")) {
        return created(await service.cerrarCaja(event));
      }

      return created(await service.abrirCaja(event));
    } catch (error) {
      if (error instanceof ServiceError) {
        return badRequest(error.message);
      }

      return serverError(error);
    }
  };
}

export const handler = createGestionCajaHandler(posService);
