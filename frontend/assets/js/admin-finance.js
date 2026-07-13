import { api, escapeHtml, formatMoney, requireAuth, toast } from './app.js';

requireAuth(['ADMIN']);
const form = document.querySelector('#finance-filter');
const details = document.querySelector('#finance-details');

async function loadFinance() {
  const params = new URLSearchParams(new FormData(form));
  const data = await api(`/admin/finance?${params}`);
  document.querySelector('[data-income]').textContent = formatMoney(data.income);
  document.querySelector('[data-sales]').textContent = data.salesCount;
  document.querySelector('[data-ticket]').textContent = formatMoney(data.averageTicket);
  document.querySelector('[data-attended]').textContent = data.attended;
  details.innerHTML = Object.keys(data.byPayment).length ? Object.entries(data.byPayment).map(([method, value]) => `<div class="card"><div class="card-title"><strong>${escapeHtml(method)}</strong><span class="price">${formatMoney(value)}</span></div></div>`).join('') : '<div class="empty">No hay ventas en el rango seleccionado.</div>';
}
form?.addEventListener('submit', (event) => { event.preventDefault(); loadFinance().catch((error) => toast(error.message, 'error')); });
loadFinance().catch((error) => toast(error.message, 'error'));
