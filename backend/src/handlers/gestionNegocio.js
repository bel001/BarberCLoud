import { eventMethod, eventPath, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { createService, getBusinessConfig, listServices, updateBusinessConfig, updateService } from '../services/business-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'ADMIN');
  const method = eventMethod(event);
  const path = eventPath(event);
  if (path.includes('/services')) {
    if (method === 'POST') return createService(parseBody(event), user);
    if (method === 'PATCH') return updateService(event.pathParameters.id, parseBody(event), user);
    return listServices({ activeOnly: false });
  }
  return method === 'PATCH' ? updateBusinessConfig(parseBody(event), user) : getBusinessConfig();
});
