const base = process.env.BASE_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(`${path}: ${payload.message || response.status}`);
  return payload.data ?? payload;
}

const health = await request('/health');
console.log('✓ Health:', health.service);

const services = await request('/api/public/services');
if (!services.length) throw new Error('No se cargaron servicios');
console.log(`✓ Servicios: ${services.length}`);

const login = await request('/api/auth/login', {
  method: 'POST',
  body: { email: 'cliente@barbercloud.com', password: 'BarberCloud2026!' }
});
console.log('✓ Login cliente:', login.user.email);

const appointments = await request('/api/client/appointments', {
  headers: { authorization: `Bearer ${login.token}` }
});
console.log(`✓ Citas cliente: ${appointments.length}`);

const admin = await request('/api/auth/login', {
  method: 'POST',
  body: { email: 'admin@barbercloud.com', password: 'BarberCloud2026!' }
});
const dashboard = await request('/api/admin/dashboard', {
  headers: { authorization: `Bearer ${admin.token}` }
});
console.log('✓ Dashboard admin:', dashboard.users, 'usuarios');
console.log('\nSmoke test completado correctamente.');
