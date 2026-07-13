import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scanByType: vi.fn(), putItem: vi.fn(async (item) => item),
  updateItem: vi.fn(), audit: vi.fn()
}));
vi.mock('../../src/lib/repository.js', () => ({
  getItem: vi.fn(), scanByType: mocks.scanByType,
  putItem: mocks.putItem, updateItem: mocks.updateItem
}));
vi.mock('../../src/lib/audit.js', () => ({ audit: mocks.audit }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'sale-id' }));

import { closeCash, createSale, getCurrentCashSession, listSales, openCash } from '../../src/services/pos-service.js';

const actor = { sub: 'secretaria-1', role: 'SECRETARIA' };

describe('pos service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scanByType.mockResolvedValue([]);
  });

  it('obtiene la sesión de caja abierta', async () => {
    mocks.scanByType.mockResolvedValue([{ id: 'c1', status: 'CLOSED' }, { id: 'c2', status: 'OPEN' }]);
    expect((await getCurrentCashSession()).id).toBe('c2');
  });

  it('abre caja y registra auditoría', async () => {
    const result = await openCash({ openingAmount: 100 }, actor);
    expect(result).toMatchObject({ id: 'sale-id', openingAmount: 100, status: 'OPEN' });
    expect(mocks.putItem).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it('impide abrir dos cajas', async () => {
    mocks.scanByType.mockResolvedValue([{ id: 'c1', status: 'OPEN' }]);
    await expect(openCash({}, actor)).rejects.toMatchObject({ code: 'CASH_ALREADY_OPEN' });
  });

  it('calcula el total de la venta en el backend', async () => {
    mocks.scanByType.mockResolvedValue([{ id: 'cash-1', status: 'OPEN' }]);
    const sale = await createSale({
      items: [
        { description: 'Corte', quantity: 1, unitPrice: 30 },
        { description: 'Cera', quantity: 2, unitPrice: 15 }
      ],
      paymentMethod: 'YAPE'
    }, actor);
    expect(sale.total).toBe(60);
    expect(sale.items[1].subtotal).toBe(30);
    expect(sale.cashSessionId).toBe('cash-1');
  });

  it('exige caja abierta y al menos un concepto', async () => {
    await expect(createSale({ items: [{}], paymentMethod: 'YAPE' }, actor)).rejects.toMatchObject({ code: 'CASH_NOT_OPEN' });
    mocks.scanByType.mockResolvedValue([{ id: 'cash-1', status: 'OPEN' }]);
    await expect(createSale({ items: [], paymentMethod: 'YAPE' }, actor)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('cierra caja calculando esperado y diferencia', async () => {
    mocks.scanByType.mockImplementation(async (type) => type === 'CASH_SESSION'
      ? [{ id: 'cash-1', status: 'OPEN', openingAmount: 100 }]
      : [{ cashSessionId: 'cash-1', total: 30 }, { cashSessionId: 'cash-1', total: 20 }]);
    mocks.updateItem.mockImplementation(async (_pk, updates) => ({ id: 'cash-1', ...updates }));
    const result = await closeCash({ closingAmount: 148 }, actor);
    expect(result).toMatchObject({ expectedAmount: 150, difference: -2, status: 'CLOSED' });
  });

  it('ordena ventas desde la más reciente', async () => {
    mocks.scanByType.mockResolvedValue([
      { id: '1', createdAt: '2026-07-01T10:00:00Z' },
      { id: '2', createdAt: '2026-07-02T10:00:00Z' }
    ]);
    expect((await listSales()).map((sale) => sale.id)).toEqual(['2', '1']);
  });
});
