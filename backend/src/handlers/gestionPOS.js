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
      return await registrarVenta(event);
    }

    const ventas = await scanByTipo("VENTA");
    const total = ventas.reduce((sum, venta) => sum + Number(venta.total || 0), 0);

    return ok({ ventas, total });
  } catch (error) {
    return serverError(error);
  }
}

async function registrarVenta(event) {
  const user = getUser(event);
  const body = JSON.parse(event.body || "{}");
  const { concepto, total, metodoPago = "EFECTIVO" } = body;

  if (!concepto || !total) {
    return badRequest("concepto y total son obligatorios");
  }

  const now = new Date().toISOString();
  const ventaId = `venta_${uuid()}`;

  await putItem({
    pk: `CAJA#${now.slice(0, 10)}`,
    sk: `VENTA#${now}#${ventaId}`,
    gsi1pk: "VENTA",
    gsi1sk: now,
    tipo: "VENTA",
    ventaId,
    concepto,
    total: Number(total),
    metodoPago,
    responsable: user.email,
    creadoEn: now
  });

  await audit(event, "POS_VENTA_REGISTRAR", "OK", { ventaId, total });

  return created({ message: "Venta registrada", ventaId });
}
