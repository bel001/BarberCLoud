import { api, escapeHtml, formData, requireAuth, setLoading, toast, today } from './app.js';

const session = requireAuth(['CLIENTE']);
const form = document.querySelector('#booking-form');
const serviceSelect = form?.querySelector('[name="serviceId"]');
const barberSelect = form?.querySelector('[name="barberId"]');
const dateInput = form?.querySelector('[name="date"]');
const slots = document.querySelector('#availability-slots');
let selectedTime = '';

async function loadOptions() {
  if (!session || !form) return;
  const [services, barbers] = await Promise.all([api('/public/services'), api('/public/barbers')]);
  serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>' + services.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${item.duration} min</option>`).join('');
  barberSelect.innerHTML = '<option value="">Selecciona un barbero</option>' + barbers.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  dateInput.min = today();
  dateInput.value = today(1);
  const preset = new URLSearchParams(location.search).get('serviceId');
  if (preset) serviceSelect.value = preset;
}

async function loadAvailability() {
  selectedTime = '';
  form.time.value = '';
  if (!serviceSelect.value || !barberSelect.value || !dateInput.value) {
    slots.innerHTML = '<div class="empty">Selecciona servicio, barbero y fecha.</div>';
    return;
  }
  slots.innerHTML = '<div class="empty">Consultando horarios...</div>';
  try {
    const data = await api(`/public/availability?serviceId=${encodeURIComponent(serviceSelect.value)}&barberId=${encodeURIComponent(barberSelect.value)}&date=${encodeURIComponent(dateInput.value)}`);
    slots.innerHTML = data.length ? data.map((time) => `<button class="slot" type="button" data-time="${time}">${time}</button>`).join('') : '<div class="empty">No hay horarios libres para esa selección.</div>';
    slots.querySelectorAll('[data-time]').forEach((button) => button.addEventListener('click', () => {
      slots.querySelectorAll('.slot').forEach((item) => item.classList.remove('selected'));
      button.classList.add('selected');
      selectedTime = button.dataset.time;
      form.time.value = selectedTime;
    }));
  } catch (error) {
    slots.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

[serviceSelect, barberSelect, dateInput].forEach((element) => element?.addEventListener('change', loadAvailability));

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedTime) return toast('Selecciona un horario disponible', 'error');
  setLoading(form, true);
  try {
    await api('/client/appointments', { method: 'POST', body: formData(form) });
    toast('Reserva registrada correctamente');
    setTimeout(() => { window.location.href = 'mis-citas.html'; }, 700);
  } catch (error) {
    toast(error.message, 'error');
    await loadAvailability();
  } finally {
    setLoading(form, false);
  }
});

loadOptions().then(loadAvailability).catch((error) => toast(error.message, 'error'));
