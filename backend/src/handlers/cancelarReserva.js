import { requireRole, getUser } from "../lib/auth.js";
import { queryByPk, putItem } from "../lib/dynamodb.js";
import { ok, badRequest, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["CLIENTE"]);

    const user = getUser(event);
    const reservaId = event.pathParameters?.id;

    if (!reservaId) {
      return badRequest("reservaId es obligatorio");
    }

    const reservas = await queryByPk(`CLIENTE#${user.sub}`);

    const reserva = reservas.find(item =>
      item.tipo === "RESERVA" &&
      item.reservaId === reservaId
    );

    if (!reserva) {
      return badRequest("Reserva no encontrada para este cliente");
    }

    if (reserva.estado === "CANCELADA") {
      return badRequest("La reserva ya se encuentra cancelada");
    }

    const reservaCancelada = {
      ...reserva,
      estado: "CANCELADA",
      canceladoEn: new Date().toISOString()
    };

    await putItem(reservaCancelada);

    if (reserva.barberoId) {
      await putItem({
        ...reservaCancelada,
        pk: `BARBERO#${reserva.barberoId}`,
        sk: `RESERVA#${reserva.fecha}#${reserva.hora}`
      });
    }

    return ok({
      message: "Reserva cancelada correctamente",
      reservaId
    });
  } catch (error) {
    return serverError(error);
  }
}
