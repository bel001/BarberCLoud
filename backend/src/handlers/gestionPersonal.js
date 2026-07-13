import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { createStaff, listUsers, updateStaff } from '../services/user-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'ADMIN');
  const method = eventMethod(event);
  if (method === 'POST') return createStaff(parseBody(event), user);
  if (method === 'PATCH') return updateStaff(event.pathParameters.id, parseBody(event), user);
  return listUsers({ search: event.queryStringParameters?.search }).then((items) => items.filter((item) => item.role !== 'CLIENTE'));
});
