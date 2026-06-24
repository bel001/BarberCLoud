import { v4 as uuid } from "uuid";
import { requireRole, getUser } from "../lib/auth.js";
import { transactWrite } from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { publishReservationEvent } from "../lib/notifications.js";
import { created, badRequest, serverError } from "../lib/response.js";

const tableName = process.env.TABLE_NAME || "barbercloud-local";

export async function handler(event) {
  try {
    requireRole(event, ["CLIENTE"]);

    const user = getUser(event);
    const body = JSON.parse(event.body || "{}");
    const { servicioId, barberoId, fecha, hora } = body;

    if (!servicioId || !barberoId || !fecha || !hora) {
      return badRequest("servicioId, barberoId, fecha y hora son obligatorios");
    }

    const reservaId = `res_${uuid()}`;
    const now = new Date().toISOString();

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
      creadoEn: now
    };

    const reservaAgenda = {
      ...reservaCliente,
      pk: `BARBERO#${barberoId}`,
      sk: `RESERVA#${fecha}#${hora}`
    };

    await transactWrite([
      {
        Put: {
          TableName: tableName,
          Item: reservaCliente,
          ConditionExpression: "attribute_not_exists(pk) OR estado = :cancelada",
          ExpressionAttributeValues: {
            ":cancelada": "CANCELADA"
          }
        }
      },
      {
        Put: {
          TableName: tableName,
          Item: reservaAgenda,
          ConditionExpression: "attribute_not_exists(pk) OR estado = :cancelada",
          ExpressionAttributeValues: {
            ":cancelada": "CANCELADA"
          }
        }
      }
    ]);

    await audit(event, "RESERVA_CREAR", "OK", { reservaId, barberoId, fecha, hora });
    await publishReservationEvent("RESERVA_CREADA", reservaCliente);

    return created({
      message: "Reserva creada correctamente",
      reservaId
    });
  } catch (error) {
    return serverError(error);
  }
}
