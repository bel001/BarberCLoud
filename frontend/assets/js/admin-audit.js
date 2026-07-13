import { api, escapeHtml, requireAuth, toast } from './app.js';

requireAuth(['ADMIN']);
const target = document.querySelector('#audit-table');

async function loadAudit() {
  const items = await api('/admin/audit');
  target.innerHTML = items.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Recurso</th></tr></thead><tbody>${items.map((item) => `<tr><td>${new Date(item.createdAt).toLocaleString('es-PE')}</td><td>${escapeHtml(item.actorRole)}<br><span class="small muted">${escapeHtml(item.actorId)}</span></td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.resource)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aún no existen registros de auditoría.</div>';
}
loadAudit().catch((error) => toast(error.message, 'error'));
