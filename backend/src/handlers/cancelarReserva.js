import { requireRole, getUser } from "../lib/auth.js";
import { queryByPk, transactWrite } from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { publishReservationEvent } from "../lib/notifications.js";
import { ok, badRequest, serverError } from "../lib/response.js";

const tableName = process.env.TABLE_NAME || "barbercloud-local";

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

    const writes = [{
      Put: {
        TableName: tableName,
        Item: reservaCancelada
      }
    }];

    if (reserva.barberoId) {
      writes.push({
        Put: {
          TableName: tableName,
          Item: {
            ...reservaCancelada,
            pk: `BARBERO#${reserva.barberoId}`,
            sk: `RESERVA#${reserva.fecha}#${reserva.hora}`
          }
        }
      });
    }

    await transactWrite(writes);
    await audit(event, "RESERVA_CANCELAR", "OK", { reservaId });
    await publishReservationEvent("RESERVA_CANCELADA", reservaCancelada);

    return ok({
      message: "Reserva cancelada correctamente",
      reservaId
    });
  } catch (error) {
    return serverError(error);
  }
}
