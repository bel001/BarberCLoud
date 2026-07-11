import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient
} from "@aws-sdk/client-cognito-identity-provider";
import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { getItem, putItem, scanByTipo } from "../lib/dynamodb.js";
import { ok, created, badRequest, serverError } from "../lib/response.js";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function handler(event) {
  try {
    requireRole(event, ["ADMIN"]);

    const method = event.requestContext.http.method;
    const path = event.rawPath || "";

    if (method === "GET") {
      return await listarPersonal();
    }

    if (method === "POST" && path.includes("/baja")) {
      return await darDeBajaPersonal(event);
    }

    return await crearPersonal(event);
  } catch (error) {
    return serverError(error);
  }
}

async function listarPersonal() {
  const [barberos, internos] = await Promise.all([
    scanByTipo("BARBERO"),
    scanByTipo("USUARIO_INTERNO")
  ]);

  return ok({ personal: [...barberos, ...internos] });
}

async function crearPersonal(event) {
  const body = JSON.parse(event.body || "{}");
  const { email, nombre, rol, password, horario } = body;

  if (!email || !nombre || !rol || !password) {
    return badRequest("email, nombre, rol y password son obligatorios");
  }

  const userPoolId = process.env.USER_POOL_ID;
  const userId = body.userId || `${rol.toLowerCase()}_${uuid()}`;

  if (userPoolId) {
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: nombre }
      ]
    }));

    try {
      await cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true
      }));

      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: email,
        GroupName: rol
      }));
    } catch (cognitoError) {
      // Compensar: eliminar usuario de Cognito si falla alguna operacion posterior
      await cognito.send(new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: email
      }));
      throw cognitoError;
    }
  }

  const item = {
    pk: `${rol}#${userId}`,
    sk: "PROFILE",
    gsi1pk: `USUARIO_EMAIL#${email}`,
    gsi1sk: `${rol}#${userId}`,
    tipo: rol === "BARBERO" ? "BARBERO" : "USUARIO_INTERNO",
    userId,
    nombre,
    email,
    rol,
    horario: horario || null,
    estado: "ACTIVO",
    creadoEn: new Date().toISOString()
  };

  if (rol === "BARBERO") {
    item.barberoId = userId;
  }

  await putItem(item);

  await audit(event, "PERSONAL_CREAR", "OK", { email, rol });

  return created({ message: "Usuario interno creado", userId, email, rol });
}

async function darDeBajaPersonal(event) {
  const body = JSON.parse(event.body || "{}");
  const { userId, rol } = body;

  if (!userId || !rol) {
    return badRequest("userId y rol son obligatorios");
  }

  const perfil = await getItem(`${rol}#${userId}`, "PROFILE");

  if (!perfil) {
    return badRequest("Usuario no encontrado");
  }

  const userPoolId = process.env.USER_POOL_ID;

  if (userPoolId && perfil.email) {
    await cognito.send(new AdminDisableUserCommand({
      UserPoolId: userPoolId,
      Username: perfil.email
    }));
  }

  await putItem({
    ...perfil,
    estado: "INACTIVO",
    bajaEn: new Date().toISOString()
  });

  await audit(event, "PERSONAL_BAJA", "OK", { userId, rol });

  return ok({ message: "Usuario dado de baja correctamente", userId });
}