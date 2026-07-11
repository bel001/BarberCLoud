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

export function buildIngresosPorMes(reservas) {
  const activas = reservas.filter(item => item.pk?.startsWith("CLIENTE#") && item.estado !== "CANCELADA");
  const porMes = {};

  activas.forEach(item => {
    const mes = String(item.fecha || "").slice(0, 7);
    if (!mes) return;
    porMes[mes] = (porMes[mes] || 0) + Number(item.precio || 0);
  });

  return Object.keys(porMes).sort().map(mes => ({ mes, ingresos: porMes[mes] }));
}

export function buildGananciasPorBarbero(reservas) {
  const activas = reservas.filter(item => item.pk?.startsWith("BARBERO#") && item.estado !== "CANCELADA");
  const porBarbero = {};

  activas.forEach(item => {
    const id = item.barberoId || item.pk.replace("BARBERO#", "");
    porBarbero[id] = (porBarbero[id] || 0) + Number(item.precio || 0);
  });

  return Object.keys(porBarbero).sort().map(barberoId => ({ barberoId, ganancias: porBarbero[barberoId] }));
}

export function buildValorInventario(inventario) {
  return inventario.reduce((total, item) => total + Number(item.stock || 0) * Number(item.precio || 0), 0);
}

export function buildCostosInsumos(insumos, inventario) {
  const preciosPorId = {};
  inventario.forEach(item => { preciosPorId[item.productoId] = Number(item.precio || 0); });

  return insumos.reduce((total, insumo) => {
    const precioUnitario = preciosPorId[insumo.insumoId] || 0;
    return total + Number(insumo.cantidad || 0) * precioUnitario;
  }, 0);
}

export function createFinanceService({ repository }) {
  return {
    async getReport() {
      const reservas = await repository.scanReservas();
      return buildFinancialReport(reservas);
    },

    async getDashboard() {
      const [reservas, inventario, insumos] = await Promise.all([
        repository.scanReservas(),
        repository.scanByTipo("INVENTARIO"),
        repository.scanByTipo("INSUMO_USO")
      ]);

      const reporte = buildFinancialReport(reservas);
      const costosInsumos = buildCostosInsumos(insumos, inventario);

      return {
        ...reporte,
        ingresosPorMes: buildIngresosPorMes(reservas),
        gananciasPorBarbero: buildGananciasPorBarbero(reservas),
        valorInventario: buildValorInventario(inventario),
        costosInsumos,
        ingresosNetos: reporte.ingresosEstimados - costosInsumos
      };
    }
  };
}
