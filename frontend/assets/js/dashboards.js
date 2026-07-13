import { api, badge, escapeHtml, formatDate, formatMoney, requireAuth, today } from './app.js';

const page = document.body.dataset.page;

async function clientDashboard() {
  requireAuth(['CLIENTE']);
  const appointments = await api('/client/appointments');
  const upcoming = appointments.filter((item) => !['CANCELADA','ATENDIDA','NO_ASISTIO'].includes(item.status));
  document.querySelector('[data-next-count]').textContent = upcoming.length;
  document.querySelector('[data-next-appointment]').innerHTML = upcoming[0] ? `
    <h3>${escapeHtml(upcoming[0].serviceName)}</h3>
    <p class="muted">${formatDate(upcoming[0].date)} · ${upcoming[0].time}</p>
    <p>Con ${escapeHtml(upcoming[0].barberName)}</p>${badge(upcoming[0].status)}
  ` : '<div class="empty">No tienes próximas citas.</div>';
}

async function barberDashboard() {
  requireAuth(['BARBERO']);
  const appointments = await api(`/barber/agenda?date=${today()}`);
  const pending = appointments.filter((item) => ['PENDIENTE','CONFIRMADA'].includes(item.status));
  document.querySelector('[data-today-count]').textContent = appointments.length;
  document.querySelector('[data-pending-count]').textContent = pending.length;
  document.querySelector('[data-today-list]').innerHTML = appointments.length ? appointments.slice(0, 5).map((item) => `<div class="card"><div class="card-title"><strong>${item.time} · ${escapeHtml(item.clientName)}</strong>${badge(item.status)}</div><p class="muted">${escapeHtml(item.serviceName)}</p></div>`).join('') : '<div class="empty">Sin citas para hoy.</div>';
}

async function secretaryDashboard() {
  requireAuth(['SECRETARIA']);
  const [agenda, clients, cash] = await Promise.all([api(`/secretary/agenda?date=${today()}`), api('/secretary/clients'), api('/secretary/cash/current')]);
  document.querySelector('[data-agenda-count]').textContent = agenda.length;
  document.querySelector('[data-clients-count]').textContent = clients.length;
  document.querySelector('[data-cash-status]').textContent = cash ? 'Abierta' : 'Cerrada';
  document.querySelector('[data-agenda-preview]').innerHTML = agenda.length ? agenda.slice(0, 5).map((item) => `<div class="card"><div class="card-title"><strong>${item.time} · ${escapeHtml(item.clientName)}</strong>${badge(item.status)}</div><p class="muted">${escapeHtml(item.serviceName)} · ${escapeHtml(item.barberName)}</p></div>`).join('') : '<div class="empty">No hay citas hoy.</div>';
}

async function adminDashboard() {
  requireAuth(['ADMIN']);
  const data = await api('/admin/dashboard');
  document.querySelector('[data-income]').textContent = formatMoney(data.finance.income);
  document.querySelector('[data-users]').textContent = data.users;
  document.querySelector('[data-today]').textContent = data.appointmentsToday;
  document.querySelector('[data-low-stock]').textContent = data.lowStock;
}

({ cliente: clientDashboard, barbero: barberDashboard, secretaria: secretaryDashboard, admin: adminDashboard })[page]?.().catch((error) => {
  const target = document.querySelector('[data-dashboard-error]');
  if (target) target.textContent = error.message;
});
