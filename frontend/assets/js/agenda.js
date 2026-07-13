import { api, badge, escapeHtml, formatDate, requireAuth, toast, today } from './app.js';

const role = document.body.dataset.role;
requireAuth(role === 'ADMIN' ? ['ADMIN'] : ['SECRETARIA']);
const prefix = role === 'ADMIN' ? '/admin' : '/secretary';
const dateInput = document.querySelector('#agenda-date');
const target = document.querySelector('#global-agenda');
const form = document.querySelector('#walkin-form');
if (dateInput) dateInput.value = today();

async function loadFilters() {
  if (!form) return;
  const [clients, services, barbers] = await Promise.all([api(`${prefix}/clients`), api('/public/services'), api('/public/barbers')]);
  form.clientId.innerHTML = '<option value="">Cliente</option>' + clients.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  form.serviceId.innerHTML = '<option value="">Servicio</option>' + services.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  form.barberId.innerHTML = '<option value="">Barbero</option>' + barbers.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  form.date.value = today();
}

async function loadAgenda() {
  target.innerHTML = '<div class="empty">Cargando agenda...</div>';
  try {
    const appointments = await api(`${prefix}/agenda?date=${encodeURIComponent(dateInput.value)}`);
    target.innerHTML = appointments.length ? `<div class="table-wrap"><table><thead><tr><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Barbero</th><th>Estado</th></tr></thead><tbody>${appointments.map((item) => `<tr><td>${item.time}</td><td>${escapeHtml(item.clientName)}<br><span class="small muted">${escapeHtml(item.clientPhone)}</span></td><td>${escapeHtml(item.serviceName)}</td><td>${escapeHtml(item.barberName)}</td><td>${badge(item.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No hay citas en esta fecha.</div>';
  } catch (error) { target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

async function loadTimes() {
  if (!form?.serviceId.value || !form?.barberId.value || !form?.date.value) return;
  const times = await api(`/public/availability?serviceId=${encodeURIComponent(form.serviceId.value)}&barberId=${encodeURIComponent(form.barberId.value)}&date=${encodeURIComponent(form.date.value)}`);
  form.time.innerHTML = '<option value="">Horario</option>' + times.map((time) => `<option>${time}</option>`).join('');
}

form?.querySelectorAll('[name="serviceId"],[name="barberId"],[name="date"]').forEach((element) => element.addEventListener('change', loadTimes));
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api(`${prefix}/appointments`, { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
    toast('Cita presencial registrada');
    form.reset();
    await loadFilters();
    await loadAgenda();
  } catch (error) { toast(error.message, 'error'); }
});

dateInput?.addEventListener('change', loadAgenda);
loadFilters().catch((error) => toast(error.message, 'error'));
loadAgenda();
