import { requireRole } from "../lib/auth.js";
import { scanByTipo } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["ADMIN"]);

    const registros = await scanByTipo("AUDIT_LOG");
    const recientes = registros
      .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)))
      .slice(0, 20);

    return ok({ actividad: recientes });
  } catch (error) {
    return serverError(error);
  }
}
