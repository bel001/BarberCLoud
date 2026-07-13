import { describe, expect, it, vi } from "vitest";
import {
  buildFinancialReport,
  buildIngresosPorMes,
  buildGananciasPorBarbero,
  buildValorInventario,
  buildCostosInsumos,
  createFinanceService
} from "../../src/services/financeService.js";

// Pruebas financieras: validan conteos, ingresos estimados
// y exclusion de reservas canceladas o copias de agenda.
describe("buildFinancialReport", () => {
  it("calcula total de reservas activas", () => {
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "CLIENTE#3", estado: "CANCELADA", origen: "ONLINE", precio: 45 }
    ];

    const report = buildFinancialReport(reservas);

    expect(report.totalReservas).toBe(2);
  });

  it("separa reservas online y presenciales", () => {
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "CLIENTE#3", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 45 }
    ];

    const report = buildFinancialReport(reservas);

    expect(report.online).toBe(1);
    expect(report.presenciales).toBe(2);
  });

  it("suma ingresos estimados ignorando canceladas y copias de agenda", () => {
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CANCELADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "BARBERO#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 }
    ];

    const report = buildFinancialReport(reservas);

    expect(report.ingresosEstimados).toBe(30);
  });

  it("suma cero cuando una reserva activa no tiene precio", () => {
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE" }
    ];

    const report = buildFinancialReport(reservas);

    expect(report.ingresosEstimados).toBe(0);
  });

  it("obtiene reporte desde repositorio inyectado", async () => {
    const repository = {
      scanReservas: vi.fn().mockResolvedValue([
        { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 }
      ])
    };
    const service = createFinanceService({ repository });

    const report = await service.getReport();

    expect(repository.scanReservas).toHaveBeenCalledTimes(1);
    expect(report).toEqual({
      totalReservas: 1,
      online: 1,
      presenciales: 0,
      ingresosEstimados: 30
    });
  });

  it("agrupa ingresos por mes ignorando canceladas y copias de barbero", () => {
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", fecha: "2026-06-15", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", fecha: "2026-06-20", precio: 20 },
      { pk: "CLIENTE#3", estado: "CONFIRMADA", fecha: "2026-07-01", precio: 45 },
      { pk: "CLIENTE#4", estado: "CANCELADA", fecha: "2026-07-02", precio: 100 },
      { pk: "BARBERO#1", estado: "CONFIRMADA", fecha: "2026-07-01", precio: 45 }
    ];

    const resultado = buildIngresosPorMes(reservas);

    expect(resultado).toEqual([
      { mes: "2026-06", ingresos: 50 },
      { mes: "2026-07", ingresos: 45 }
    ]);
  });

  it("agrupa ganancias por barbero desde las copias BARBERO#", () => {
    const reservas = [
      { pk: "BARBERO#barbero_carlos", barberoId: "barbero_carlos", estado: "CONFIRMADA", precio: 30 },
      { pk: "BARBERO#barbero_carlos", barberoId: "barbero_carlos", estado: "FINALIZADO", precio: 45 },
      { pk: "BARBERO#barbero_ana", barberoId: "barbero_ana", estado: "CONFIRMADA", precio: 20 },
      { pk: "BARBERO#barbero_ana", barberoId: "barbero_ana", estado: "CANCELADA", precio: 999 },
      { pk: "CLIENTE#1", estado: "CONFIRMADA", precio: 30 }
    ];

    const resultado = buildGananciasPorBarbero(reservas);

    expect(resultado).toEqual([
      { barberoId: "barbero_ana", ganancias: 20 },
      { barberoId: "barbero_carlos", ganancias: 75 }
    ]);
  });

  it("calcula el valor total del inventario", () => {
    const inventario = [
      { stock: 10, precio: 5 },
      { stock: 4, precio: 25 }
    ];

    const valor = buildValorInventario(inventario);

    expect(valor).toBe(150);
  });

  it("calcula costos de insumos solo cuando hay precio de catalogo", () => {
    const insumos = [
      { insumoId: "cera", cantidad: 2 },
      { insumoId: "gel-sin-catalogo", cantidad: 5 }
    ];
    const inventario = [{ productoId: "cera", precio: 25 }];

    const costos = buildCostosInsumos(insumos, inventario);

    expect(costos).toBe(50);
  });

  it("arma el dashboard financiero completo desde el repositorio", async () => {
    const repository = {
      scanReservas: vi.fn().mockResolvedValue([
        { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", fecha: "2026-07-01", precio: 30 },
        { pk: "BARBERO#barbero_carlos", barberoId: "barbero_carlos", estado: "CONFIRMADA", precio: 30 }
      ]),
      scanByTipo: vi.fn((tipo) => {
        if (tipo === "INVENTARIO") return Promise.resolve([{ productoId: "cera", stock: 10, precio: 25 }]);
        if (tipo === "INSUMO_USO") return Promise.resolve([{ insumoId: "cera", cantidad: 2 }]);
        return Promise.resolve([]);
      })
    };
    const service = createFinanceService({ repository });

    const dashboard = await service.getDashboard();

    expect(dashboard.ingresosEstimados).toBe(30);
    expect(dashboard.ingresosPorMes).toEqual([{ mes: "2026-07", ingresos: 30 }]);
    expect(dashboard.gananciasPorBarbero).toEqual([{ barberoId: "barbero_carlos", ganancias: 30 }]);
    expect(dashboard.valorInventario).toBe(250);
    expect(dashboard.costosInsumos).toBe(50);
    expect(dashboard.ingresosNetos).toBe(-20);
  });
});
