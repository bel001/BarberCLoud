import { requireRole } from "../lib/auth.js";
import { scanReservas } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["ADMIN"]);

    const reservas = await scanReservas();
    const reservasCliente = reservas.filter(item => item.pk?.startsWith("CLIENTE#"));
    const activas = reservasCliente.filter(item => item.estado !== "CANCELADA");

    return ok({
      totalReservas: activas.length,
      online: activas.filter(item => item.origen === "ONLINE").length,
      presenciales: activas.filter(item => item.origen === "PRESENCIAL").length,
      ingresosEstimados: activas.reduce((total, item) => total + Number(item.precio || 0), 0)
    });
  } catch (error) {
    return serverError(error);
  }
}
