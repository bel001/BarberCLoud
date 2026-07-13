import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { createClientByStaff, listUsers } from '../services/user-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'SECRETARIA');
  return eventMethod(event) === 'POST'
    ? createClientByStaff(parseBody(event), user)
    : listUsers({ role: 'CLIENTE', search: event.queryStringParameters?.search });
});
