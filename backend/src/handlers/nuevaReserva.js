import { eventUser, parseBody, wrap } from '../lib/lambda.js';
import { createAppointment } from '../services/appointment-service.js';

export const handler = wrap((event) => {
  const user = eventUser(event);
  const payload = parseBody(event);
  return createAppointment({ ...payload, clientId: payload.clientId || user.sub }, user, 'ONLINE');
});
