import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { createAppointment, listAppointments, rescheduleAppointment } from '../services/appointment-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'CLIENTE');
  const method = eventMethod(event);
  if (method === 'POST') return createAppointment({ ...parseBody(event), clientId: user.sub }, user, 'ONLINE');
  if (method === 'PUT') return rescheduleAppointment(event.pathParameters.id, parseBody(event), user);
  return listAppointments({ clientId: user.sub, ...(event.queryStringParameters || {}) }, user);
});
