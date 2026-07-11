import { requireRole, getUser } from "../lib/auth.js";
import { queryByPk } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["CLIENTE"]);

    const user = getUser(event);
    const items = await queryByPk(`CLIENTE#${user.sub}`);

    const reservas = items.filter(item => item.tipo === "RESERVA");
    const canjes = items.filter(item => item.tipo === "CANJE");
    const perfil = items.find(item => item.tipo === "CLIENTE");

    return ok({ reservas, canjes, puntos: perfil?.puntos || 0 });
  } catch (error) {
    return serverError(error);
  }
}
