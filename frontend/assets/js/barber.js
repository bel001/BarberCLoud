import { api, badge, escapeHtml, formDialog, formatDate, requireAuth, toast, today } from './app.js';

requireAuth(['BARBERO']);
const dateInput = document.querySelector('#agenda-date');
const target = document.querySelector('#barber-agenda');
const suppliesTarget = document.querySelector('#barber-supplies');
if (dateInput) dateInput.value = today();

async function loadAgenda() {
  if (!target) return;
  target.innerHTML = '<div class="empty">Cargando agenda...</div>';
  try {
    const appointments = await api(`/barber/agenda?date=${encodeURIComponent(dateInput.value)}`);
    target.innerHTML = appointments.length ? appointments.map((item) => `
      <article class="card">
        <div class="card-title"><div><h3>${item.time} · ${escapeHtml(item.clientName)}</h3><span class="muted">${escapeHtml(item.serviceName)}</span></div>${badge(item.status)}</div>
        <p class="small muted">${formatDate(item.date)} · Tel. ${escapeHtml(item.clientPhone)}</p>
        <div class="actions">
          ${['PENDIENTE','CONFIRMADA'].includes(item.status) ? `<button class="btn btn-sm" data-status="EN_ATENCION" data-id="${item.id}">Iniciar</button>` : ''}
          ${item.status === 'EN_ATENCION' ? `<button class="btn btn-success btn-sm" data-status="ATENDIDA" data-id="${item.id}">Finalizar</button>` : ''}
          ${!['ATENDIDA','CANCELADA','NO_ASISTIO'].includes(item.status) ? `<button class="btn btn-danger btn-sm" data-status="NO_ASISTIO" data-id="${item.id}">No asistió</button>` : ''}
        </div>
      </article>`).join('') : '<div class="empty">No tienes citas en esta fecha.</div>';
    target.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await api(`/barber/appointments/${button.dataset.id}/status`, { method: 'PATCH', body: { status: button.dataset.status } });
        toast('Estado actualizado');
        await loadAgenda();
      } catch (error) { toast(error.message, 'error'); }
    }));
  } catch (error) { target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

async function loadSupplies() {
  if (!suppliesTarget) return;
  const items = await api('/barber/supplies');
  suppliesTarget.innerHTML = items.map((item) => `
    <article class="card"><div class="card-title"><strong>${escapeHtml(item.name)}</strong><span class="badge ${item.stock <= item.minimum ? 'badge-low' : ''}">${item.stock} ${escapeHtml(item.unit)}</span></div>
    <div class="actions"><button class="btn btn-sm" data-use="${item.id}" data-name="${escapeHtml(item.name)}">Registrar consumo</button></div></article>`).join('');
  suppliesTarget.querySelectorAll('[data-use]').forEach((button) => button.addEventListener('click', async () => {
    const values = await formDialog({
      eyebrow: 'Control de insumos',
      title: `Registrar consumo de ${button.dataset.name}`,
      description: 'Indica cuántas unidades utilizaste durante la atención.',
      icon: '−',
      fields: [{ name: 'quantity', label: 'Cantidad utilizada', type: 'number', value: 1, min: 1, step: 1, inputMode: 'numeric' }],
      confirmText: 'Registrar consumo'
    });
    if (!values) return;
    const quantity = Number(values.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return toast('Ingresa una cantidad válida', 'error');
    try {
      await api('/barber/supplies/usage', { method: 'POST', body: { inventoryId: button.dataset.use, quantity } });
      toast('Consumo registrado');
      await loadSupplies();
    } catch (error) { toast(error.message, 'error'); }
  }));
}

dateInput?.addEventListener('change', loadAgenda);
loadAgenda();
loadSupplies().catch((error) => toast(error.message, 'error'));
