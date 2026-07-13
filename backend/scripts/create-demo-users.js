import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient
} from '@aws-sdk/client-cognito-identity-provider';
import { putItem } from '../src/lib/repository.js';
import { config } from '../src/lib/config.js';

const userPoolId = process.env.USER_POOL_ID;
const password = process.env.DEMO_PASSWORD || 'BarberCloud2026!';
if (!userPoolId || !process.env.TABLE_NAME) {
  console.error('Define USER_POOL_ID y TABLE_NAME antes de ejecutar este script.');
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({ region: config.region });
const users = [
  { email: 'cliente@barbercloud.com', name: 'Carlos Cliente', phone: '+51987654321', role: 'CLIENTE' },
  { email: 'barbero@barbercloud.com', name: 'Diego Barbero', phone: '+51986111222', role: 'BARBERO', specialties: ['Corte clásico', 'Barba'] },
  { email: 'secretaria@barbercloud.com', name: 'Ana Secretaria', phone: '+51985333444', role: 'SECRETARIA' },
  { email: 'admin@barbercloud.com', name: 'Lucía Administradora', phone: '+51984555666', role: 'ADMIN' }
];

for (const user of users) {
  try {
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: user.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: user.name },
        { Name: 'phone_number', Value: user.phone }
      ]
    }));
  } catch (error) {
    if (error.name !== 'UsernameExistsException') throw error;
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
    GroupName: user.role
  }));
  const cognitoUser = await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: user.email }));
  const sub = cognitoUser.UserAttributes?.find((item) => item.Name === 'sub')?.Value;
  if (!sub) throw new Error(`Cognito no devolvió sub para ${user.email}`);
  await putItem({
    PK: `USER#${sub}`,
    SK: 'META',
    GSI1PK: `ROLE#${user.role}`,
    GSI1SK: user.name.toLowerCase(),
    entityType: 'USER',
    id: sub,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    specialties: user.specialties,
    active: true,
    createdAt: new Date().toISOString()
  });
  console.log(`Usuario Cognito y perfil DynamoDB listos: ${user.email} (${user.role})`);
}
