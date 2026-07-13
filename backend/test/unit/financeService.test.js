import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scanByTypeMock } = vi.hoisted(() => ({ scanByTypeMock: vi.fn() }));
vi.mock('../../src/lib/repository.js', () => ({ scanByType: scanByTypeMock }));

import { calculateFinance, getFinance } from '../../src/services/finance-service.js';

describe('finance service', () => {
  beforeEach(() => scanByTypeMock.mockReset());

  it('calcula ingresos, ticket, estados y métodos de pago', () => {
    const result = calculateFinance({
      sales: [
        { total: 30, paymentMethod: 'EFECTIVO' },
        { total: 60, paymentMethod: 'YAPE' },
        { total: 10, paymentMethod: 'EFECTIVO' }
      ],
      appointments: [
        { status: 'ATENDIDA' }, { status: 'CANCELADA' },
        { status: 'PENDIENTE' }, { status: 'CONFIRMADA' }
      ]
    });
    expect(result).toMatchObject({ income: 100, salesCount: 3, attended: 1, cancelled: 1, pending: 2 });
    expect(result.averageTicket).toBeCloseTo(33.333, 2);
    expect(result.byPayment).toEqual({ EFECTIVO: 40, YAPE: 60 });
  });

  it('devuelve ticket cero sin ventas', () => {
    expect(calculateFinance({ sales: [], appointments: [] }).averageTicket).toBe(0);
  });

  it('filtra reporte por fecha', async () => {
    scanByTypeMock.mockImplementation(async (type) => type === 'SALE'
      ? [
          { total: 20, paymentMethod: 'YAPE', createdAt: '2026-07-01T10:00:00Z' },
          { total: 50, paymentMethod: 'EFECTIVO', createdAt: '2026-07-15T10:00:00Z' }
        ]
      : [
          { status: 'ATENDIDA', date: '2026-07-01' },
          { status: 'PENDIENTE', date: '2026-07-15' }
        ]);
    const result = await getFinance({ from: '2026-07-10', to: '2026-07-31' });
    expect(result.income).toBe(50);
    expect(result.pending).toBe(1);
    expect(result.attended).toBe(0);
  });
});
