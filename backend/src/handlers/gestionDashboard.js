import { requireEventRole, wrap } from '../lib/lambda.js';
import { listAppointments } from '../services/appointment-service.js';
import { getFinance } from '../services/finance-service.js';
import { listInventory } from '../services/inventory-service.js';
import { listUsers } from '../services/user-service.js';

export const handler = wrap(async (event) => {
  const user = requireEventRole(event, 'ADMIN');
  const [finance, users, inventory, appointments] = await Promise.all([
    getFinance(), listUsers(), listInventory(), listAppointments({}, user)
  ]);
  return {
    finance,
    users: users.length,
    clients: users.filter((item) => item.role === 'CLIENTE').length,
    staff: users.filter((item) => item.role !== 'CLIENTE').length,
    lowStock: inventory.filter((item) => item.stock <= item.minimum).length,
    appointmentsToday: appointments.filter((item) => item.date === new Date().toISOString().slice(0, 10)).length
  };
});
