import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient
} from "@aws-sdk/client-cognito-identity-provider";
import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { putItem } from "../lib/dynamodb.js";
import { created, badRequest, serverError } from "../lib/response.js";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function handler(event) {
  try {
    requireRole(event, ["ADMIN"]);

    const body = JSON.parse(event.body || "{}");
    const { email, nombre, rol, password } = body;

    if (!email || !nombre || !rol || !password) {
      return badRequest("email, nombre, rol y password son obligatorios");
    }

    const userPoolId = process.env.USER_POOL_ID;
    const userId = body.userId || `${rol.toLowerCase()}_${uuid()}`;

    let cognitoUserCreated = false;

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

      cognitoUserCreated = true;

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
      creadoEn: new Date().toISOString()
    };

    if (rol === "BARBERO") {
      item.barberoId = userId;
    }

    await putItem(item);

    await audit(event, "PERSONAL_CREAR", "OK", { email, rol });

    return created({ message: "Usuario interno creado", userId, email, rol });
  } catch (error) {
    return serverError(error);
  }
}