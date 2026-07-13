import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { listAppointments, updateAppointmentStatus } from '../services/appointment-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'BARBERO');
  if (eventMethod(event) === 'PATCH') {
    return updateAppointmentStatus(event.pathParameters.id, parseBody(event).status, user);
  }
  const barberId = user.role === 'ADMIN' ? event.queryStringParameters?.barberId : user.sub;
  return listAppointments({ date: event.queryStringParameters?.date, barberId }, user);
});
