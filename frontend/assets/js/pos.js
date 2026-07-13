import { api, escapeHtml, formDialog, formatMoney, formData, requireAuth, toast } from './app.js';

const session = requireAuth(['SECRETARIA','ADMIN']);
const prefix = session?.user?.role === 'ADMIN' ? '/admin' : '/secretary';
const cashStatus = document.querySelector('#cash-status');
const salesTarget = document.querySelector('#sales-table');
const saleForm = document.querySelector('#sale-form');
const openForm = document.querySelector('#open-cash-form');
const closeButton = document.querySelector('#close-cash');

async function loadCash() {
  const cash = await api(`${prefix}/cash/current`);
  cashStatus.innerHTML = cash ? `<span class="badge badge-ATENDIDA">Caja abierta</span><p class="muted small">Monto inicial: ${formatMoney(cash.openingAmount)} · ${new Date(cash.openedAt).toLocaleString('es-PE')}</p>` : '<span class="badge badge-CANCELADA">Caja cerrada</span>';
  saleForm.querySelector('button[type="submit"]').disabled = !cash;
  closeButton.disabled = !cash;
  openForm.classList.toggle('hidden', Boolean(cash));
}

async function loadSales() {
  const sales = await api(`${prefix}/pos/sales`);
  salesTarget.innerHTML = sales.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Pago</th><th>Total</th></tr></thead><tbody>${sales.map((sale) => `<tr><td>${new Date(sale.createdAt).toLocaleString('es-PE')}</td><td>${sale.items.map((item) => escapeHtml(item.description)).join(', ')}</td><td>${escapeHtml(sale.paymentMethod)}</td><td>${formatMoney(sale.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Todavía no hay ventas.</div>';
}

openForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api(`${prefix}/cash/open`, { method: 'POST', body: formData(openForm) });
    toast('Caja abierta');
    await loadCash();
  } catch (error) { toast(error.message, 'error'); }
});

closeButton?.addEventListener('click', async () => {
  const values = await formDialog({
    eyebrow: 'Cierre de caja',
    title: 'Confirmar efectivo contado',
    description: 'Ingresa el dinero físico contado. También puedes dejar el campo vacío para usar el monto esperado.',
    icon: 'S/',
    fields: [{ name: 'closingAmount', label: 'Efectivo contado', type: 'number', required: false, min: 0, step: '0.01', inputMode: 'decimal', placeholder: 'Usar monto esperado' }],
    confirmText: 'Cerrar caja',
    tone: 'danger'
  });
  if (!values) return;
  const rawAmount = String(values.closingAmount || '').trim();
  const closingAmount = rawAmount === '' ? null : Number(rawAmount);
  if (closingAmount !== null && (!Number.isFinite(closingAmount) || closingAmount < 0)) return toast('Ingresa un monto válido', 'error');
  try {
    const result = await api(`${prefix}/cash/close`, { method: 'POST', body: closingAmount === null ? {} : { closingAmount } });
    toast(`Caja cerrada. Diferencia: ${formatMoney(result.difference)}`);
    await Promise.all([loadCash(), loadSales()]);
  } catch (error) { toast(error.message, 'error'); }
});

saleForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = formData(saleForm);
  try {
    await api(`${prefix}/pos/sales`, {
      method: 'POST',
      body: {
        paymentMethod: data.paymentMethod,
        items: [{ description: data.description, quantity: Number(data.quantity), unitPrice: Number(data.unitPrice) }]
      }
    });
    toast('Venta registrada');
    saleForm.reset();
    saleForm.quantity.value = 1;
    await loadSales();
  } catch (error) { toast(error.message, 'error'); }
});

Promise.all([loadCash(), loadSales()]).catch((error) => toast(error.message, 'error'));
