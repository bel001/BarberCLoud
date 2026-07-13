import { eventPath, wrap } from '../lib/lambda.js';
import { getBusinessConfig, listServices } from '../services/business-service.js';
import { listBarbers } from '../services/appointment-service.js';

export const handler = wrap((event) => {
  const path = eventPath(event);
  if (path.endsWith('/services')) return listServices();
  if (path.endsWith('/barbers')) return listBarbers();
  if (path.endsWith('/business')) return getBusinessConfig();
  return [];
});
