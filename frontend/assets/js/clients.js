import { api, escapeHtml, formData, requireAuth, toast } from './app.js';

const session = requireAuth(['SECRETARIA','ADMIN']);
const prefix = session?.user?.role === 'ADMIN' ? '/admin' : '/secretary';
const target = document.querySelector('#clients-table');
const form = document.querySelector('#client-form');
const search = document.querySelector('#client-search');

async function loadClients() {
  const items = await api(`${prefix}/clients?search=${encodeURIComponent(search?.value || '')}`);
  target.innerHTML = items.length ? `<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Registro</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.phone)}</td><td>${new Date(item.createdAt).toLocaleDateString('es-PE')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No se encontraron clientes.</div>';
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = await api(`${prefix}/clients`, { method: 'POST', body: formData(form) });
    toast(`Cliente creado. Contraseña temporal: ${result.temporaryPassword}`);
    form.reset();
    await loadClients();
  } catch (error) { toast(error.message, 'error'); }
});
search?.addEventListener('input', () => loadClients().catch(() => {}));
loadClients().catch((error) => toast(error.message, 'error'));
