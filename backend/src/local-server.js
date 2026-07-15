import express from 'express'; import { registry, httpMetricsMiddleware, handleGrafanaWebhook } from './lib/observability.js';
import cors from 'cors';
import { config } from './lib/config.js';
import { AppError } from './lib/errors.js';
import { authMiddleware, allow } from './lib/auth.js';
import { ok } from './lib/response.js';
import { login, registerClient, createClientByStaff, getUser, updateProfile, listUsers, createStaff, updateStaff } from './services/user-service.js';
import { listServices, getBusinessConfig, createService, updateService, updateBusinessConfig } from './services/business-service.js';
import { listBarbers, getAvailability, createAppointment, listAppointments, rescheduleAppointment, cancelAppointment, updateAppointmentStatus } from './services/appointment-service.js';
import { listInventory, createInventoryItem, updateInventory, registerUsage } from './services/inventory-service.js';
import { getCurrentCashSession, openCash, closeCash, createSale, listSales } from './services/pos-service.js';
import { getFinance } from './services/finance-service.js';
import { scanByType } from './lib/repository.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '1mb' })); app.use(httpMetricsMiddleware);

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const send = (res, data, message) => res.json(ok(data, message));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'barbercloud-backend', mode: 'local', timestamp: new Date().toISOString() })); app.get('/metrics', asyncRoute(async (_req, res) => { res.set('Content-Type', registry.contentType); res.end(await registry.metrics()); })); app.post('/alerts/grafana', handleGrafanaWebhook);

// Solo local. En AWS, Cognito Hosted UI y API Gateway JWT reemplazan estas dos rutas.
app.post('/api/auth/login', asyncRoute(async (req, res) => send(res, await login(req.body), 'Sesión iniciada')));
app.post('/api/auth/register', asyncRoute(async (req, res) => send(res, await registerClient(req.body), 'Cuenta creada')));

// API pública
app.get('/api/public/services', asyncRoute(async (_req, res) => send(res, await listServices())));
app.get('/api/public/barbers', asyncRoute(async (_req, res) => send(res, await listBarbers())));
app.get('/api/public/business', asyncRoute(async (_req, res) => send(res, await getBusinessConfig())));
app.get('/api/public/availability', asyncRoute(async (req, res) => send(res, await getAvailability(req.query))));

// Cliente
app.use('/api/client', authMiddleware, allow('CLIENTE'));
app.get('/api/client/me', asyncRoute(async (req, res) => send(res, await getUser(req.user.sub))));
app.put('/api/client/me', asyncRoute(async (req, res) => send(res, await updateProfile(req.user.sub, req.body, req.user), 'Perfil actualizado')));
app.get('/api/client/appointments', asyncRoute(async (req, res) => send(res, await listAppointments({ clientId: req.user.sub, ...req.query }, req.user))));
app.post('/api/client/appointments', asyncRoute(async (req, res) => send(res, await createAppointment({ ...req.body, clientId: req.user.sub }, req.user, 'ONLINE'), 'Reserva creada')));
app.put('/api/client/appointments/:id/reschedule', asyncRoute(async (req, res) => send(res, await rescheduleAppointment(req.params.id, req.body, req.user), 'Reserva reprogramada')));
app.delete('/api/client/appointments/:id', asyncRoute(async (req, res) => send(res, await cancelAppointment(req.params.id, req.user), 'Reserva cancelada')));

// Barbero
app.use('/api/barber', authMiddleware, allow('BARBERO'));
app.get('/api/barber/agenda', asyncRoute(async (req, res) => send(res, await listAppointments({ barberId: req.user.sub, date: req.query.date }, req.user))));
app.patch('/api/barber/appointments/:id/status', asyncRoute(async (req, res) => send(res, await updateAppointmentStatus(req.params.id, req.body.status, req.user), 'Estado actualizado')));
app.get('/api/barber/supplies', asyncRoute(async (_req, res) => send(res, await listInventory())));
app.post('/api/barber/supplies/usage', asyncRoute(async (req, res) => send(res, await registerUsage(req.body, req.user), 'Consumo registrado')));

const clientList = async (req, res) => send(res, await listUsers({ role: 'CLIENTE', search: req.query.search }));
const clientCreate = async (req, res) => send(res, await createClientByStaff(req.body, req.user), 'Cliente registrado');
const globalAgenda = async (req, res) => send(res, await listAppointments(req.query, req.user));
const walkInAppointment = async (req, res) => send(res, await createAppointment(req.body, req.user, 'PRESENCIAL'), 'Cita presencial registrada');
const inventoryList = async (_req, res) => send(res, await listInventory());
const inventoryCreate = async (req, res) => send(res, await createInventoryItem(req.body, req.user), 'Insumo creado');
const inventoryUpdate = async (req, res) => send(res, await updateInventory(req.params.id, req.body, req.user), 'Inventario actualizado');
const salesList = async (_req, res) => send(res, await listSales());
const salesCreate = async (req, res) => send(res, await createSale(req.body, req.user), 'Venta registrada');
const cashCurrent = async (_req, res) => send(res, await getCurrentCashSession());
const cashOpen = async (req, res) => send(res, await openCash(req.body, req.user), 'Caja abierta');
const cashClose = async (req, res) => send(res, await closeCash(req.body, req.user), 'Caja cerrada');

// Secretaria. ADMIN también está autorizado por la matriz de permisos de allow().
app.use('/api/secretary', authMiddleware, allow('SECRETARIA'));
app.get('/api/secretary/clients', asyncRoute(clientList));
app.post('/api/secretary/clients', asyncRoute(clientCreate));
app.get('/api/secretary/agenda', asyncRoute(globalAgenda));
app.post('/api/secretary/appointments', asyncRoute(walkInAppointment));
app.get('/api/secretary/inventory', asyncRoute(inventoryList));
app.post('/api/secretary/inventory', asyncRoute(inventoryCreate));
app.patch('/api/secretary/inventory/:id', asyncRoute(inventoryUpdate));
app.get('/api/secretary/pos/sales', asyncRoute(salesList));
app.post('/api/secretary/pos/sales', asyncRoute(salesCreate));
app.get('/api/secretary/cash/current', asyncRoute(cashCurrent));
app.post('/api/secretary/cash/open', asyncRoute(cashOpen));
app.post('/api/secretary/cash/close', asyncRoute(cashClose));

// Administrador
app.use('/api/admin', authMiddleware, allow('ADMIN'));
app.get('/api/admin/dashboard', asyncRoute(async (req, res) => {
  const [finance, users, inventory, appointments] = await Promise.all([
    getFinance(), listUsers(), listInventory(), listAppointments({}, req.user)
  ]);
  send(res, {
    finance,
    users: users.length,
    clients: users.filter((item) => item.role === 'CLIENTE').length,
    staff: users.filter((item) => item.role !== 'CLIENTE').length,
    lowStock: inventory.filter((item) => item.stock <= item.minimum).length,
    appointmentsToday: appointments.filter((item) => item.date === new Date().toISOString().slice(0, 10)).length
  });
}));
app.get('/api/admin/staff', asyncRoute(async (req, res) => send(res, await listUsers({ search: req.query.search }).then((items) => items.filter((item) => item.role !== 'CLIENTE')))));
app.post('/api/admin/staff', asyncRoute(async (req, res) => send(res, await createStaff(req.body, req.user), 'Personal creado')));
app.patch('/api/admin/staff/:id', asyncRoute(async (req, res) => send(res, await updateStaff(req.params.id, req.body, req.user), 'Personal actualizado')));
app.get('/api/admin/services', asyncRoute(async (_req, res) => send(res, await listServices({ activeOnly: false }))));
app.post('/api/admin/services', asyncRoute(async (req, res) => send(res, await createService(req.body, req.user), 'Servicio creado')));
app.patch('/api/admin/services/:id', asyncRoute(async (req, res) => send(res, await updateService(req.params.id, req.body, req.user), 'Servicio actualizado')));
app.get('/api/admin/business', asyncRoute(async (_req, res) => send(res, await getBusinessConfig())));
app.patch('/api/admin/business', asyncRoute(async (req, res) => send(res, await updateBusinessConfig(req.body, req.user), 'Negocio actualizado')));
app.get('/api/admin/finance', asyncRoute(async (req, res) => send(res, await getFinance(req.query))));
app.get('/api/admin/audit', asyncRoute(async (_req, res) => {
  const items = await scanByType('AUDIT');
  send(res, items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200));
}));

// Alias operativos del administrador. Reutilizan exactamente los mismos servicios.
app.get('/api/admin/clients', asyncRoute(clientList));
app.post('/api/admin/clients', asyncRoute(clientCreate));
app.get('/api/admin/agenda', asyncRoute(globalAgenda));
app.post('/api/admin/appointments', asyncRoute(walkInAppointment));
app.get('/api/admin/inventory', asyncRoute(inventoryList));
app.post('/api/admin/inventory', asyncRoute(inventoryCreate));
app.patch('/api/admin/inventory/:id', asyncRoute(inventoryUpdate));
app.get('/api/admin/pos/sales', asyncRoute(salesList));
app.post('/api/admin/pos/sales', asyncRoute(salesCreate));
app.get('/api/admin/cash/current', asyncRoute(cashCurrent));
app.post('/api/admin/cash/open', asyncRoute(cashOpen));
app.post('/api/admin/cash/close', asyncRoute(cashClose));

app.use((_req, _res, next) => next(new AppError('Ruta no encontrada', 404, 'NOT_FOUND')));
app.use((error, _req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    ok: false,
    error: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
    message: error instanceof AppError ? error.message : 'Ocurrió un error interno'
  });
});

app.listen(config.port, () => {
  console.log(`BarberCloud API local en http://localhost:${config.port}`);
});
