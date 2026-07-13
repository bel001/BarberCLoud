import { requireEventRole, wrap } from '../lib/lambda.js';
import { getFinance } from '../services/finance-service.js';

export const handler = wrap((event) => {
  requireEventRole(event, 'ADMIN');
  return getFinance(event.queryStringParameters || {});
});
