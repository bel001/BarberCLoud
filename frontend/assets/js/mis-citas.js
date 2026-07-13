import { api, badge, confirmDialog, escapeHtml, formDialog, formatDate, requireAuth, toast, today } from './app.js';

requireAuth(['CLIENTE']);
const target = document.querySelector('#appointments-list');

async function loadAppointments() {
  target.innerHTML = '<div class="empty">Cargando tus citas...</div>';
  try {
    const appointments = await api('/client/appointments');
    target.innerHTML = appointments.length ? appointments.map((item) => `
      <article class="card">
        <div class="card-title"><div><h3>${escapeHtml(item.serviceName)}</h3><span class="muted">${formatDate(item.date)} · ${item.time}</span></div>${badge(item.status)}</div>
        <p class="muted">Barbero: ${escapeHtml(item.barberName)}</p>
        ${item.notes ? `<p class="small">Nota: ${escapeHtml(item.notes)}</p>` : ''}
        <div class="actions">
          ${!['CANCELADA','ATENDIDA','NO_ASISTIO'].includes(item.status) ? `<button class="btn btn-sm" data-reschedule="${item.id}" data-service="${item.serviceId}" data-barber="${item.barberId}">Reprogramar</button><button class="btn btn-danger btn-sm" data-cancel="${item.id}">Cancelar</button>` : ''}
        </div>
      </article>
    `).join('') : '<div class="empty">Todavía no tienes reservas.</div>';

    target.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        eyebrow: 'Gestionar reserva',
        title: '¿Cancelar esta cita?',
        description: 'El horario volverá a quedar disponible para otros clientes. Esta acción quedará registrada.',
        confirmText: 'Sí, cancelar cita',
        cancelText: 'Conservar cita',
        icon: '×',
        tone: 'danger'
      });
      if (!confirmed) return;
      try {
        await api(`/client/appointments/${button.dataset.cancel}`, { method: 'DELETE' });
        toast('Reserva cancelada');
        await loadAppointments();
      } catch (error) { toast(error.message, 'error'); }
    }));

    target.querySelectorAll('[data-reschedule]').forEach((button) => button.addEventListener('click', () => openReschedule(button.dataset)));
  } catch (error) {
    target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function openReschedule(data) {
  const dateValues = await formDialog({
    eyebrow: 'Reprogramar cita',
    title: 'Elige una nueva fecha',
    description: 'Te mostraremos únicamente los horarios que siguen disponibles para el mismo servicio y barbero.',
    icon: '◷',
    fields: [{ name: 'date', label: 'Nueva fecha', type: 'date', value: today(1), min: today(1) }],
    confirmText: 'Buscar horarios'
  });
  if (!dateValues) return;
  const date = dateValues.date;
  try {
    const times = await api(`/public/availability?serviceId=${encodeURIComponent(data.service)}&barberId=${encodeURIComponent(data.barber)}&date=${encodeURIComponent(date)}`);
    if (!times.length) return toast('No hay horarios disponibles en esa fecha', 'error');
    const timeValues = await formDialog({
      eyebrow: 'Reprogramar cita',
      title: 'Selecciona el nuevo horario',
      description: `${formatDate(date)} · ${times.length} ${times.length === 1 ? 'horario disponible' : 'horarios disponibles'}.`,
      icon: '◷',
      fields: [{ name: 'time', label: 'Horario disponible', type: 'select', value: times[0], options: times.map((time) => ({ value: time, label: time })) }],
      confirmText: 'Confirmar reprogramación'
    });
    if (!timeValues) return;
    const time = timeValues.time;
    if (!times.includes(time)) return toast('Horario inválido', 'error');
    await api(`/client/appointments/${data.reschedule}/reschedule`, { method: 'PUT', body: { date, time } });
    toast('Reserva reprogramada');
    await loadAppointments();
  } catch (error) { toast(error.message, 'error'); }
}

loadAppointments();
