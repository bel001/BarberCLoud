import { v4 as uuid } from "uuid";
import { requireRole, getUser } from "../lib/auth.js";
import { putItem, queryByPk } from "../lib/dynamodb.js";
import { created, badRequest, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["CLIENTE"]);

    const user = getUser(event);
    const body = JSON.parse(event.body || "{}");
    const { servicioId, barberoId, fecha, hora } = body;

    if (!servicioId || !barberoId || !fecha || !hora) {
      return badRequest("servicioId, barberoId, fecha y hora son obligatorios");
    }

    const agenda = await queryByPk(`BARBERO#${barberoId}`);

    const conflicto = agenda.find(item =>
      item.fecha === fecha &&
      item.hora === hora &&
      item.estado !== "CANCELADA"
    );

    if (conflicto) {
      return badRequest("Horario no disponible");
    }

    const reservaId = `res_${uuid()}`;

    const reservaCliente = {
      pk: `CLIENTE#${user.sub}`,
      sk: `RESERVA#${fecha}#${hora}`,
      tipo: "RESERVA",
      reservaId,
      clienteId: user.sub,
      clienteNombre: user.name,
      clienteCorreo: user.email,
      servicioId,
      barberoId,
      fecha,
      hora,
      origen: "ONLINE",
      estado: "CONFIRMADA",
      creadoPor: "CLIENTE",
      creadoEn: new Date().toISOString()
    };

    const reservaAgenda = {
      ...reservaCliente,
      pk: `BARBERO#${barberoId}`,
      sk: `RESERVA#${fecha}#${hora}`
    };

    await putItem(reservaCliente);
    await putItem(reservaAgenda);

    return created({
      message: "Reserva creada correctamente",
      reservaId
    });
  } catch (error) {
    return serverError(error);
  }
}
