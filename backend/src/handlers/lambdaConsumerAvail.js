import { handler as consultarDisponibilidad } from "./consultarDisponibilidad.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    const source = event.source || event.Records?.[0]?.EventSource || "aws.events";

    if (!String(source).includes("aws.events") && !String(source).includes("aws:sns")) {
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
