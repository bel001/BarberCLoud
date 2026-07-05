import { v4 as uuid } from "uuid";
import { getUser, hasRole, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { putItem, scanByTipo } from "../lib/dynamodb.js";
import { created, ok, badRequest, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["BARBERO", "ADMIN"]);

    const method = event.requestContext.http.method;

    if (method === "POST") {
      return await registrarInsumo(event);
    }

    const user = getUser(event);
    const consumos = await scanByTipo("INSUMO_USO");

    return ok({
      insumos: hasRole(event, ["ADMIN"])
        ? consumos
        : consumos.filter(item => item.barberoId === user.sub)
    });
  } catch (error) {
    return serverError(error);
  }
}

async function registrarInsumo(event) {
  const user = getUser(event);
  const body = JSON.parse(event.body || "{}");
  const { insumoId, nombre, cantidad } = body;

  if (!insumoId || !nombre || !cantidad) {
    return badRequest("insumoId, nombre y cantidad son obligatorios");
  }

  const now = new Date().toISOString();
  const consumoId = `insumo_${uuid()}`;

  await putItem({
    pk: `BARBERO#${user.sub}`,
    sk: `INSUMO#${now}#${consumoId}`,
    gsi1pk: "INSUMO_USO",
    gsi1sk: now,
    tipo: "INSUMO_USO",
    consumoId,
    barberoId: user.sub,
    barberoCorreo: user.email,
    insumoId,
    nombre,
    cantidad: Number(cantidad),
    creadoEn: now
  });

  await audit(event, "INSUMO_REGISTRAR", "OK", { consumoId, insumoId, cantidad });

  return created({ message: "Consumo de insumo registrado", consumoId });
}
