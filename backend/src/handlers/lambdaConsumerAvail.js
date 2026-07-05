import { handler as consultarDisponibilidad } from "./consultarDisponibilidad.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    const source = event.source || event.Records?.[0]?.EventSource || "aws.events";

    // Validacion exacta de origen AWS para prevenir spoofing
    const fuenteValida = source === "aws.events" || source === "aws.sns";
    if (!fuenteValida) {
      const error = new Error("Evento de disponibilidad no autorizado");
      error.statusCode = 403;
      throw error;
    }

    await consultarDisponibilidad({ queryStringParameters: {} });

    return ok({ message: "Disponibilidad refrescada" });
  } catch (error) {
    return serverError(error);
  }
}