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
    // Preparar: definir datos, mocks y contexto del caso
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "CLIENTE#3", estado: "CANCELADA", origen: "ONLINE", precio: 45 }
    ];

    // Ejecutar: llamar la funcion o handler bajo prueba
    const report = buildFinancialReport(reservas);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(report.totalReservas).toBe(2);
  });

  it("separa reservas online y presenciales", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "CLIENTE#3", estado: "CONFIRMADA", origen: "PRESENCIAL", precio: 45 }
    ];

    // Ejecutar: llamar la funcion o handler bajo prueba
    const report = buildFinancialReport(reservas);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(report.online).toBe(1);
    expect(report.presenciales).toBe(2);
  });

  it("suma ingresos estimados ignorando canceladas y copias de agenda", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 },
      { pk: "CLIENTE#2", estado: "CANCELADA", origen: "PRESENCIAL", precio: 20 },
      { pk: "BARBERO#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 }
    ];

    // Ejecutar: llamar la funcion o handler bajo prueba
    const report = buildFinancialReport(reservas);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(report.ingresosEstimados).toBe(30);
  });

  it("suma cero cuando una reserva activa no tiene precio", () => {
    // Preparar: definir datos, mocks y contexto del caso
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE" }
    ];

    // Ejecutar: llamar la funcion o handler bajo prueba
    const report = buildFinancialReport(reservas);

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(report.ingresosEstimados).toBe(0);
  });

  it("obtiene reporte desde repositorio inyectado", async () => {
    // Preparar: definir datos, mocks y contexto del caso
    const repository = {
      scanReservas: vi.fn().mockResolvedValue([
        { pk: "CLIENTE#1", estado: "CONFIRMADA", origen: "ONLINE", precio: 30 }
      ])
    };
    const service = createFinanceService({ repository });

    // Ejecutar: llamar la funcion o handler bajo prueba
    const report = await service.getReport();

    // Verificar: confirmar la respuesta y los efectos esperados
    expect(repository.scanReservas).toHaveBeenCalledTimes(1);
    expect(report).toEqual({
      totalReservas: 1,
      online: 1,
      presenciales: 0,
      ingresosEstimados: 30
    });
  });

  it("agrupa ingresos por mes ignorando canceladas y copias de barbero", () => {
    // Arrange
    const reservas = [
      { pk: "CLIENTE#1", estado: "CONFIRMADA", fecha: "2026-06-15", precio: 30 },
      { pk: "CLIENTE#2", estado: "CONFIRMADA", fecha: "2026-06-20", precio: 20 },
      { pk: "CLIENTE#3", estado: "CONFIRMADA", fecha: "2026-07-01", precio: 45 },
      { pk: "CLIENTE#4", estado: "CANCELADA", fecha: "2026-07-02", precio: 100 },
      { pk: "BARBERO#1", estado: "CONFIRMADA", fecha: "2026-07-01", precio: 45 }
    ];

    // Act
    const resultado = buildIngresosPorMes(reservas);

    // Assert
    expect(resultado).toEqual([
      { mes: "2026-06", ingresos: 50 },
      { mes: "2026-07", ingresos: 45 }
    ]);
  });

  it("agrupa ganancias por barbero desde las copias BARBERO#", () => {
    // Arrange
    const reservas = [
      { pk: "BARBERO#barbero_carlos", barberoId: "barbero_carlos", estado: "CONFIRMADA", precio: 30 },
      { pk: "BARBERO#barbero_carlos", barberoId: "barbero_carlos", estado: "FINALIZADO", precio: 45 },
      { pk: "BARBERO#barbero_ana", barberoId: "barbero_ana", estado: "CONFIRMADA", precio: 20 },
      { pk: "BARBERO#barbero_ana", barberoId: "barbero_ana", estado: "CANCELADA", precio: 999 },
      { pk: "CLIENTE#1", estado: "CONFIRMADA", precio: 30 }
    ];

    // Act
    const resultado = buildGananciasPorBarbero(reservas);

    // Assert
    expect(resultado).toEqual([
      { barberoId: "barbero_ana", ganancias: 20 },
      { barberoId: "barbero_carlos", ganancias: 75 }
    ]);
  });

  it("calcula el valor total del inventario", () => {
    // Arrange
    const inventario = [
      { stock: 10, precio: 5 },
      { stock: 4, precio: 25 }
    ];

    // Act
    const valor = buildValorInventario(inventario);

    // Assert
    expect(valor).toBe(150);
  });

  it("calcula costos de insumos solo cuando hay precio de catalogo", () => {
    // Arrange
    const insumos = [
      { insumoId: "cera", cantidad: 2 },
      { insumoId: "gel-sin-catalogo", cantidad: 5 }
    ];
    const inventario = [{ productoId: "cera", precio: 25 }];

    // Act
    const costos = buildCostosInsumos(insumos, inventario);

    // Assert
    expect(costos).toBe(50);
  });

  it("arma el dashboard financiero completo desde el repositorio", async () => {
    // Arrange
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

    // Act
    const dashboard = await service.getDashboard();

    // Assert
    expect(dashboard.ingresosEstimados).toBe(30);
    expect(dashboard.ingresosPorMes).toEqual([{ mes: "2026-07", ingresos: 30 }]);
    expect(dashboard.gananciasPorBarbero).toEqual([{ barberoId: "barbero_carlos", ganancias: 30 }]);
    expect(dashboard.valorInventario).toBe(250);
    expect(dashboard.costosInsumos).toBe(50);
    expect(dashboard.ingresosNetos).toBe(-20);
  });
});
