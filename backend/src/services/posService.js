import { getUser } from "../lib/auth.js";
import { ServiceError } from "./errors.js";

export const IGV_RATE = 0.18;

export function validateSaleInput(body) {
  const { concepto, total, metodoPago = "EFECTIVO" } = body;

  if (!concepto || !total) {
    throw new ServiceError("concepto y total son obligatorios");
  }

  return {
    concepto,
    total: Number(total),
    metodoPago
  };
}

export function calculateCashTotal(ventas) {
  return ventas.reduce((sum, venta) => sum + Number(venta.total || 0), 0);
}

export function createPosService({
  repository,
  auditLog,
  idGenerator,
  clock = () => new Date()
}) {
  return {
    async listSales() {
      const ventas = await repository.scanByTipo("VENTA");
      const fecha = clock().toISOString().slice(0, 10);
      const itemsCaja = await repository.queryByPk(`CAJA#${fecha}`);
      const sesionCaja = itemsCaja.find(item => item.tipo === "CAJA_SESION" && item.estado === "ABIERTA") || null;

      return {
        ventas,
        total: calculateCashTotal(ventas),
        sesionCaja
      };
    },

    async registerSale(event) {
      const user = getUser(event);
      const body = JSON.parse(event.body || "{}");
      const sale = validateSaleInput(body);
      const now = clock().toISOString();
      const ventaId = `venta_${idGenerator()}`;
      const impuesto = Math.round(sale.total * IGV_RATE * 100) / 100;
      const totalConImpuesto = Math.round((sale.total + impuesto) * 100) / 100;

      await repository.putItem({
        pk: `CAJA#${now.slice(0, 10)}`,
        sk: `VENTA#${now}#${ventaId}`,
        gsi1pk: "VENTA",
        gsi1sk: now,
        tipo: "VENTA",
        ventaId,
        concepto: sale.concepto,
        total: sale.total,
        impuesto,
        totalConImpuesto,
        metodoPago: sale.metodoPago,
        responsable: user.email,
        creadoEn: now
      });

      await auditLog(event, "POS_VENTA_REGISTRAR", "OK", { ventaId, total: sale.total });

      return { message: "Venta registrada", ventaId, impuesto, totalConImpuesto };
    },

    async abrirCaja(event) {
      const user = getUser(event);
      const body = JSON.parse(event.body || "{}");
      const montoInicial = Number(body.montoInicial || 0);
      const now = clock().toISOString();
      const fecha = now.slice(0, 10);

      const items = await repository.queryByPk(`CAJA#${fecha}`);
      const sesionAbierta = items.find(item => item.tipo === "CAJA_SESION" && item.estado === "ABIERTA");

      if (sesionAbierta) {
        throw new ServiceError("Ya existe una caja abierta para hoy");
      }

      const sesionId = `sesion_${idGenerator()}`;

      await repository.putItem({
        pk: `CAJA#${fecha}`,
        sk: `SESION#${now}`,
        tipo: "CAJA_SESION",
        sesionId,
        montoInicial,
        estado: "ABIERTA",
        abiertoPor: user.email,
        abiertoEn: now
      });

      await auditLog(event, "CAJA_ABRIR", "OK", { sesionId, montoInicial });

      return { message: "Caja abierta correctamente", sesionId, montoInicial };
    },

    async cerrarCaja(event) {
      const user = getUser(event);
      const body = JSON.parse(event.body || "{}");
      const { montoContado } = body;

      if (montoContado === undefined || montoContado === null) {
        throw new ServiceError("montoContado es obligatorio");
      }

      const now = clock().toISOString();
      const fecha = now.slice(0, 10);
      const items = await repository.queryByPk(`CAJA#${fecha}`);
      const sesion = items.find(item => item.tipo === "CAJA_SESION" && item.estado === "ABIERTA");

      if (!sesion) {
        throw new ServiceError("No hay una caja abierta para cerrar");
      }

      const ventasEfectivo = items.filter(item => item.tipo === "VENTA" && item.metodoPago === "EFECTIVO");
      const montoEsperado = Number(sesion.montoInicial) + calculateCashTotal(ventasEfectivo);
      const diferencia = Math.round((Number(montoContado) - montoEsperado) * 100) / 100;

      await repository.putItem({
        ...sesion,
        estado: "CERRADA",
        montoContado: Number(montoContado),
        montoEsperado,
        diferencia,
        cerradoPor: user.email,
        cerradoEn: now
      });

      await auditLog(event, "CAJA_CERRAR", "OK", { sesionId: sesion.sesionId, diferencia });

      return { message: "Caja cerrada correctamente", montoEsperado, montoContado: Number(montoContado), diferencia };
    }
  };
}
