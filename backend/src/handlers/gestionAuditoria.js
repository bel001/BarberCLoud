import { requireEventRole, wrap } from '../lib/lambda.js';
import { scanByType } from '../lib/repository.js';

export const handler = wrap(async (event) => {
  requireEventRole(event, 'ADMIN');
  const items = await scanByType('AUDIT');
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
});
