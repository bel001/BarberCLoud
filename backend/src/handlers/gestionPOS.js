import { eventMethod, eventPath, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { closeCash, createSale, getCurrentCashSession, listSales, openCash } from '../services/pos-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'SECRETARIA');
  const path = eventPath(event);
  const method = eventMethod(event);
  if (path.endsWith('/cash/current')) return getCurrentCashSession();
  if (path.endsWith('/cash/open')) return openCash(parseBody(event), user);
  if (path.endsWith('/cash/close')) return closeCash(parseBody(event), user);
  return method === 'POST' ? createSale(parseBody(event), user) : listSales();
});
