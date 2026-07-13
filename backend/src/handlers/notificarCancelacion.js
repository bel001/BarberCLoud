import { wrap } from '../lib/lambda.js';

export const handler = wrap(async (event) => ({
  processed: (event.Records || []).length,
  channel: 'SES/SQS',
  note: 'SQS queda como cola de reintentos, no como respuesta HTTP.'
}));
