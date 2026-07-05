import { getSnsRecords, sendReservationEmail } from "../lib/notifications.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    for (const record of getSnsRecords(event)) {
      const reserva = record.reserva || record;
      await sendReservationEmail({
        to: reserva.clienteCorreo,
        subject: "Reserva cancelada - BarberCloud",
        message: `Tu reserva ${reserva.reservaId} para ${reserva.fecha} a las ${reserva.hora} fue cancelada.`
      });
    }

    return ok({ message: "Notificacion de cancelacion procesada" });
  } catch (error) {
    return serverError(error);
  }
}
