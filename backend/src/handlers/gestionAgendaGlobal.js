import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { createAppointment, listAppointments } from '../services/appointment-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'SECRETARIA');
  return eventMethod(event) === 'POST'
    ? createAppointment(parseBody(event), user, 'PRESENCIAL')
    : listAppointments(event.queryStringParameters || {}, user);
});
