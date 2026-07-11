import { requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";
import { createFinanceService } from "../services/financeService.js";

const financeService = createFinanceService({ repository });

export function createGestionFinancieraHandler(service) {
  return async function gestionFinancieraHandler(event) {
    try {
      requireRole(event, ["ADMIN"]);

      if (event.rawPath?.includes("/dashboard-financiero")) {
        return ok(await service.getDashboard());
      }

      return ok(await service.getReport());
    } catch (error) {
      return serverError(error);
    }
  };
}

export const handler = createGestionFinancieraHandler(financeService);
