import { scanByTipo } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(_event) {
  try {
    const servicios = await scanByTipo("SERVICIO");
    const inventario = await scanByTipo("INVENTARIO");

    return ok({
      message: "Configuracion operativa actualizada",
      servicios: servicios.length,
      inventario: inventario.length,
      actualizadoEn: new Date().toISOString()
    });
  } catch (error) {
    return serverError(error);
  }
}