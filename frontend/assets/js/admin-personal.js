import { api, escapeHtml, formData, requireAuth, toast } from './app.js';

requireAuth(['ADMIN']);
const target = document.querySelector('#staff-table');
const form = document.querySelector('#staff-form');

async function loadStaff() {
  const staff = await api('/admin/staff');
  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${staff.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.role)}</td><td>${item.active ? '<span class="badge badge-ATENDIDA">Activo</span>' : '<span class="badge badge-CANCELADA">Inactivo</span>'}</td><td><button class="btn btn-sm ${item.active ? 'btn-danger' : 'btn-success'}" data-toggle="${item.id}" data-active="${item.active}">${item.active ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('')}</tbody></table></div>`;
  target.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/admin/staff/${button.dataset.toggle}`, { method: 'PATCH', body: { active: button.dataset.active !== 'true' } });
      toast('Personal actualizado');
      await loadStaff();
    } catch (error) { toast(error.message, 'error'); }
  }));
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api('/admin/staff', { method: 'POST', body: formData(form) });
    toast(`Personal creado. Contraseña temporal: ${result.temporaryPassword}`);
    form.reset();
    await loadStaff();
  } catch (error) { toast(error.message, 'error'); }
});
loadStaff().catch((error) => toast(error.message, 'error'));
