import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient
} from "@aws-sdk/client-cognito-identity-provider";

const userPoolId = process.env.USER_POOL_ID;
const password = process.env.DEMO_PASSWORD || "BarberCloud2026!";
const region = process.env.AWS_REGION || "us-east-1";

if (!userPoolId) {
  console.error("USER_POOL_ID es obligatorio");
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({ region });
const users = [
  { email: "cliente@barbercloud.com", name: "Cliente Demo", group: "CLIENTE" },
  { email: "secretaria@barbercloud.com", name: "Secretaria Demo", group: "SECRETARIA" },
  { email: "barbero@barbercloud.com", name: "Carlos Barbero", group: "BARBERO" },
  { email: "admin@barbercloud.com", name: "Administrador", group: "ADMIN" }
];

for (const user of users) {
  try {
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: user.email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: user.name }
      ]
    }));
  } catch (error) {
    if (error.name !== "UsernameExistsException") {
      throw error;
    }
  }

  await client.send(new AdminSetUserPasswordCommand({
    UserPoolId: userPoolId,
    Username: user.email,
    Password: password,
    Permanent: true
  }));

  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId,
    Username: user.email,
    GroupName: user.group
  }));

  console.log(`Usuario demo listo: ${user.email} (${user.group})`);
}
