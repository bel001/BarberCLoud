import { v4 as uuid } from "uuid";
import { getUser, requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { putItem, scanByTipo } from "../lib/dynamodb.js";
import { created, ok, badRequest, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["SECRETARIA", "ADMIN"]);

    const method = event.requestContext.http.method;

    if (method === "POST") {
      return await registrarProducto(event);
    }

    return ok({ inventario: await scanByTipo("INVENTARIO") });
  } catch (error) {
    return serverError(error);
  }
}

async function registrarProducto(event) {
  const user = getUser(event);
  const body = JSON.parse(event.body || "{}");
  const { productoId = `prod_${uuid()}`, nombre, stock, precio } = body;

  if (!nombre || stock === undefined) {
    return badRequest("nombre y stock son obligatorios");
  }

  const now = new Date().toISOString();

  await putItem({
    pk: `INVENTARIO#${productoId}`,
    sk: "PROFILE",
    gsi1pk: "INVENTARIO",
    gsi1sk: nombre,
    tipo: "INVENTARIO",
    productoId,
    nombre,
    stock: Number(stock),
    precio: Number(precio || 0),
    actualizadoPor: user.email,
    actualizadoEn: now
  });

  await audit(event, "INVENTARIO_ACTUALIZAR", "OK", { productoId, stock });

  return created({ message: "Inventario actualizado", productoId });
}
