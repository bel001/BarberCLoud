import { api, escapeHtml, formData, formDialog, requireAuth, toast } from './app.js';

const role = document.body.dataset.role;
requireAuth(role === 'ADMIN' ? ['ADMIN'] : ['SECRETARIA']);
const prefix = role === 'ADMIN' ? '/admin' : '/secretary';
const target = document.querySelector('#inventory-table');
const form = document.querySelector('#inventory-form');

async function loadInventory() {
  const items = await api(`${prefix}/inventory`);
  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Insumo</th><th>Stock</th><th>Mínimo</th><th>Costo</th><th>Acción</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><span class="badge ${item.stock <= item.minimum ? 'badge-low' : ''}">${item.stock} ${escapeHtml(item.unit)}</span></td><td>${item.minimum}</td><td>S/ ${Number(item.cost || 0).toFixed(2)}</td><td><button class="btn btn-sm" data-stock="${item.id}" data-current="${item.stock}">Ajustar</button></td></tr>`).join('')}</tbody></table></div>`;
  target.querySelectorAll('[data-stock]').forEach((button) => button.addEventListener('click', async () => {
    const values = await formDialog({
      eyebrow: 'Inventario',
      title: 'Ajustar existencias',
      description: 'Registra el stock físico disponible actualmente.',
      icon: '≡',
      fields: [{ name: 'stock', label: 'Nuevo stock', type: 'number', value: button.dataset.current, min: 0, step: 1, inputMode: 'numeric', helper: 'El valor no puede ser negativo.' }],
      confirmText: 'Actualizar stock'
    });
    if (!values) return;
    const stock = Number(values.stock);
    if (!Number.isInteger(stock) || stock < 0) return toast('Ingresa un stock válido', 'error');
    try {
      await api(`${prefix}/inventory/${button.dataset.stock}`, { method: 'PATCH', body: { stock } });
      toast('Stock actualizado');
      await loadInventory();
    } catch (error) { toast(error.message, 'error'); }
  }));
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api(`${prefix}/inventory`, { method: 'POST', body: formData(form) });
    toast('Insumo creado');
    form.reset();
    await loadInventory();
  } catch (error) { toast(error.message, 'error'); }
});
loadInventory().catch((error) => toast(error.message, 'error'));
