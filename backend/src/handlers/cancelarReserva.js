import { requireEventRole, wrap } from '../lib/lambda.js';
import { cancelAppointment } from '../services/appointment-service.js';

export const handler = wrap((event) => cancelAppointment(event.pathParameters.id, requireEventRole(event, 'CLIENTE')));
