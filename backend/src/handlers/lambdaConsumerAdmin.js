import { handler as manageServices } from "./manageServices.js";
import { ok, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    const source = event.source || "aws.events";

    // Validacion exacta de origen AWS para prevenir spoofing
    const fuenteValida = source === "aws.events" || source === "aws.sns";
    if (!fuenteValida) {
      const error = new Error("Evento administrativo no autorizado");
      error.statusCode = 403;
      throw error;
    }

    await manageServices(event);

    return ok({ message: "Proceso administrativo ejecutado" });
  } catch (error) {
    return serverError(error);
  }
}