import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { listInventory, registerUsage } from '../services/inventory-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'BARBERO');
  return eventMethod(event) === 'POST' ? registerUsage(parseBody(event), user) : listInventory();
});
