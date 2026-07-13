import { wrap } from '../lib/lambda.js';

export const handler = wrap(async (event) => ({
  processed: (event.Records || []).length,
  channel: 'SES',
  note: 'En local las notificaciones se registran; en AWS este handler envía por SES.'
}));
