export function buildFinancialReport(reservas) {
  const reservasCliente = reservas.filter(item => item.pk?.startsWith("CLIENTE#"));
  const activas = reservasCliente.filter(item => item.estado !== "CANCELADA");

  return {
    totalReservas: activas.length,
    online: activas.filter(item => item.origen === "ONLINE").length,
    presenciales: activas.filter(item => item.origen === "PRESENCIAL").length,
    ingresosEstimados: activas.reduce((total, item) => total + Number(item.precio || 0), 0)
  };
}

export function createFinanceService({ repository }) {
  return {
    async getReport() {
      const reservas = await repository.scanReservas();
      return buildFinancialReport(reservas);
    }
  };
}
