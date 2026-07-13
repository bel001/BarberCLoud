import { api, escapeHtml, formData, formDialog, formatMoney, requireAuth, toast } from './app.js';

requireAuth(['ADMIN']);
const businessForm = document.querySelector('#business-form');
const serviceForm = document.querySelector('#service-form');
const servicesTarget = document.querySelector('#admin-services');

async function loadBusiness() {
  const data = await api('/admin/business');
  Object.entries(data).forEach(([key, value]) => { if (businessForm.elements[key]) businessForm.elements[key].value = value ?? ''; });
}

async function loadServices() {
  const services = await api('/admin/services');
  servicesTarget.innerHTML = `<div class="table-wrap services-table-wrap"><table class="services-table"><thead><tr><th>Servicio</th><th>Duración</th><th>Precio</th><th>Gestión</th></tr></thead><tbody>${services.map((item) => `<tr><td class="service-name-cell"><div class="service-name-line"><strong>${escapeHtml(item.name)}</strong>${item.active ? '<span class="badge badge-ATENDIDA">Activo</span>' : '<span class="badge badge-CANCELADA">Inactivo</span>'}</div><span class="small muted service-description">${escapeHtml(item.description || 'Sin descripción')}</span></td><td>${item.duration} min</td><td><strong>${formatMoney(item.price)}</strong></td><td><div class="service-actions"><button class="btn btn-sm" data-price="${item.id}" data-current="${item.price}">Cambiar precio</button><button class="btn btn-sm ${item.active ? 'btn-danger' : 'btn-success'}" data-toggle="${item.id}" data-active="${item.active}">${item.active ? 'Desactivar' : 'Activar'}</button></div></td></tr>`).join('')}</tbody></table></div>`;
  servicesTarget.querySelectorAll('[data-price]').forEach((button) => button.addEventListener('click', async () => {
    const values = await formDialog({
      eyebrow: 'Gestión de servicios',
      title: 'Actualizar precio',
      description: 'Define el nuevo precio del servicio. El cambio se reflejará inmediatamente en el catálogo.',
      icon: 'S/',
      fields: [{ name: 'price', label: 'Nuevo precio', type: 'number', value: button.dataset.current, min: 0, step: '0.01', inputMode: 'decimal', helper: 'Ingresa el monto en soles.' }],
      confirmText: 'Actualizar precio'
    });
    if (!values) return;
    const price = Number(values.price);
    if (!Number.isFinite(price) || price < 0) return toast('Ingresa un precio válido', 'error');
    try { await api(`/admin/services/${button.dataset.price}`, { method: 'PATCH', body: { price } }); toast('Precio actualizado'); await loadServices(); } catch (error) { toast(error.message, 'error'); }
  }));
  servicesTarget.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', async () => {
    try { await api(`/admin/services/${button.dataset.toggle}`, { method: 'PATCH', body: { active: button.dataset.active !== 'true' } }); toast('Servicio actualizado'); await loadServices(); } catch (error) { toast(error.message, 'error'); }
  }));
}

businessForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('/admin/business', { method: 'PATCH', body: formData(businessForm) }); toast('Configuración guardada'); } catch (error) { toast(error.message, 'error'); }
});
serviceForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('/admin/services', { method: 'POST', body: formData(serviceForm) }); toast('Servicio creado'); serviceForm.reset(); await loadServices(); } catch (error) { toast(error.message, 'error'); }
});
Promise.all([loadBusiness(), loadServices()]).catch((error) => toast(error.message, 'error'));
