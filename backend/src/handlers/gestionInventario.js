import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { createInventoryItem, listInventory, updateInventory } from '../services/inventory-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'SECRETARIA');
  const method = eventMethod(event);
  if (method === 'POST') return createInventoryItem(parseBody(event), user);
  if (method === 'PATCH') return updateInventory(event.pathParameters.id, parseBody(event), user);
  return listInventory();
});
