import { scanByType } from '../lib/repository.js';

export function calculateFinance({ sales, appointments }) {
  const income = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const attended = appointments.filter((item) => item.status === 'ATENDIDA').length;
  const cancelled = appointments.filter((item) => item.status === 'CANCELADA').length;
  const pending = appointments.filter((item) => ['PENDIENTE', 'CONFIRMADA', 'EN_ATENCION'].includes(item.status)).length;
  const byPayment = sales.reduce((acc, sale) => {
    acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + Number(sale.total || 0);
    return acc;
  }, {});
  return {
    income,
    salesCount: sales.length,
    averageTicket: sales.length ? income / sales.length : 0,
    attended,
    cancelled,
    pending,
    byPayment
  };
}

export async function getFinance({ from, to } = {}) {
  let sales = await scanByType('SALE');
  let appointments = await scanByType('APPOINTMENT');
  if (from) {
    sales = sales.filter((item) => item.createdAt.slice(0, 10) >= from);
    appointments = appointments.filter((item) => item.date >= from);
  }
  if (to) {
    sales = sales.filter((item) => item.createdAt.slice(0, 10) <= to);
    appointments = appointments.filter((item) => item.date <= to);
  }
  return calculateFinance({ sales, appointments });
}
