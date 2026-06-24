import { sendReservationEmail } from "../lib/notifications.js";
import { ok, serverError } from "../lib/response.js";

function parseRecord(record) {
  const body = JSON.parse(record.body || "{}");

  if (body.Type === "Notification" && body.Message) {
    return JSON.parse(body.Message);
  }

  return body;
}

export async function handler(event) {
  try {
    for (const record of event.Records || []) {
      const payload = parseRecord(record);
      const reserva = payload.reserva || payload;

      if (!reserva?.clienteCorreo) continue;

      const isCancelacion = payload.eventType === "RESERVA_CANCELADA";

      await sendReservationEmail({
        to: reserva.clienteCorreo,
        subject: isCancelacion ? "Reserva cancelada - BarberCloud" : "Reserva confirmada - BarberCloud",
        message: isCancelacion
          ? `Tu reserva ${reserva.reservaId} para ${reserva.fecha} a las ${reserva.hora} fue cancelada.`
          : `Tu reserva para ${reserva.fecha} a las ${reserva.hora} fue confirmada. Codigo: ${reserva.reservaId}`
      });
    }

    return ok({ message: "Cola de notificaciones procesada" });
  } catch (error) {
    return serverError(error);
  }
}
