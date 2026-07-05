import { getSnsRecords, sendReservationEmail } from "../lib/notifications.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    for (const record of getSnsRecords(event)) {
      const reserva = record.reserva || record;
      await sendReservationEmail({
        to: reserva.clienteCorreo,
        subject: "Reserva confirmada - BarberCloud",
        message: `Tu reserva para ${reserva.fecha} a las ${reserva.hora} fue confirmada. Codigo: ${reserva.reservaId}`
      });
    }

    return ok({ message: "Notificacion de reserva procesada" });
  } catch (error) {
    return serverError(error);
  }
}
