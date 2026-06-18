import { requireRole, getUser } from "../lib/auth.js";
import { queryByPk } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["CLIENTE"]);

    const user = getUser(event);
    const reservas = await queryByPk(`CLIENTE#${user.sub}`);

    const soloReservas = reservas.filter(item => item.tipo === "RESERVA");

    return ok(soloReservas);
  } catch (error) {
    return serverError(error);
  }
}
