import { wrap } from '../lib/lambda.js';
import { getAvailability } from '../services/appointment-service.js';

export const handler = wrap((event) => getAvailability(event.queryStringParameters || {}));
