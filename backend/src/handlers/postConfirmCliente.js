import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { putItem } from "../lib/dynamodb.js";

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function handler(event) {
  const attributes = event.request?.userAttributes || {};
  const email = attributes.email;
  const sub = attributes.sub || event.userName;
  const name = attributes.name || email || "Cliente";
  const userPoolId = event.userPoolId || process.env.USER_POOL_ID;

  if (userPoolId && event.userName) {
    await cognito.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: event.userName,
      GroupName: "CLIENTE"
    }));
  }

  if (email && sub) {
    await putItem({
      pk: `CLIENTE#${sub}`,
      sk: "PROFILE",
      tipo: "CLIENTE",
      clienteId: sub,
      nombre: name,
      email,
      gsi1pk: `CLIENTE_EMAIL#${email}`,
      gsi1sk: `CLIENTE#${sub}`,
      creadoEn: new Date().toISOString()
    });
  }

  return event;
}
