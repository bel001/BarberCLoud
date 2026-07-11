import { requireRole, getUser } from "../lib/auth.js";
import { getItem, putItem } from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { ok, badRequest, serverError } from "../lib/response.js";

export async function handler(event) {
  try {
    requireRole(event, ["CLIENTE"]);

    const user = getUser(event);
    const method = event.requestContext.http.method;

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { nombre } = body;

      if (!nombre) {
        return badRequest("nombre es obligatorio");
      }

      const perfil = await getItem(`CLIENTE#${user.sub}`, "PROFILE");

      await putItem({
        ...perfil,
        pk: `CLIENTE#${user.sub}`,
        sk: "PROFILE",
        tipo: "CLIENTE",
        clienteId: user.sub,
        nombre,
        email: perfil?.email || user.email,
        gsi1pk: `CLIENTE_EMAIL#${perfil?.email || user.email}`,
        gsi1sk: `CLIENTE#${user.sub}`
      });

      await audit(event, "CUENTA_ACTUALIZAR", "OK", { clienteId: user.sub });

      return ok({ message: "Datos actualizados correctamente", nombre });
    }

    const perfil = await getItem(`CLIENTE#${user.sub}`, "PROFILE");

    return ok({
      nombre: perfil?.nombre || user.name,
      email: perfil?.email || user.email
    });
  } catch (error) {
    return serverError(error);
  }
}
