import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { putItem, scanByTipo } from "../lib/dynamodb.js";
import { created, ok, badRequest, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["ADMIN"]);

    const method = event.requestContext.http.method;

    if (method === "POST") {
      return await guardarServicio(event);
    }

    return ok({ servicios: await scanByTipo("SERVICIO") });
  } catch (error) {
    return serverError(error);
  }
}

async function guardarServicio(event) {
  const body = JSON.parse(event.body || "{}");
  const { servicioId = `servicio_${uuid()}`, nombre, precio, duracionMinutos = 45, estado = "ACTIVO" } = body;

  if (!nombre || precio === undefined) {
    return badRequest("nombre y precio son obligatorios");
  }

  await putItem({
    pk: `SERVICIO#${servicioId}`,
    sk: "PROFILE",
    gsi1pk: "SERVICIO",
    gsi1sk: nombre,
    tipo: "SERVICIO",
    servicioId,
    nombre,
    precio: Number(precio),
    duracionMinutos: Number(duracionMinutos),
    estado,
    actualizadoEn: new Date().toISOString()
  });

  await audit(event, "NEGOCIO_SERVICIO_GUARDAR", "OK", { servicioId, precio });

  return created({ message: "Servicio guardado", servicioId });
}
