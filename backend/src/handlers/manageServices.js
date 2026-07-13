import { wrap } from '../lib/lambda.js';
import { scanByType } from '../lib/repository.js';

export const handler = wrap(async () => {
  const appointments = await scanByType('APPOINTMENT');
  const expired = appointments.filter((item) => item.status === 'PENDIENTE' && `${item.date}T${item.time}` < new Date().toISOString().slice(0, 16));
  return { checked: appointments.length, expiredCandidates: expired.length };
});
