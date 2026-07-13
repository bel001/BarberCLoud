import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../lib/config.js';
import { upsertCognitoClient } from '../services/user-service.js';

const cognito = new CognitoIdentityProviderClient({ region: config.region });

export const handler = async (event) => {
  const attributes = event.request?.userAttributes || {};
  await cognito.send(new AdminAddUserToGroupCommand({
    UserPoolId: event.userPoolId,
    Username: event.userName,
    GroupName: 'CLIENTE'
  }));
  await upsertCognitoClient({
    id: attributes.sub,
    name: attributes.name || attributes.email,
    email: attributes.email,
    phone: attributes.phone_number || ''
  });
  return event;
};
