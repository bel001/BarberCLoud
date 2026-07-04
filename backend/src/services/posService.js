import { getUser } from "../lib/auth.js";
import { ServiceError } from "./errors.js";

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
      return {
        ventas,
        total: calculateCashTotal(ventas)
      };
    },

    async registerSale(event) {
      const user = getUser(event);
      const body = JSON.parse(event.body || "{}");
      const sale = validateSaleInput(body);
      const now = clock().toISOString();
      const ventaId = `venta_${idGenerator()}`;

      await repository.putItem({
        pk: `CAJA#${now.slice(0, 10)}`,
        sk: `VENTA#${now}#${ventaId}`,
        gsi1pk: "VENTA",
        gsi1sk: now,
        tipo: "VENTA",
        ventaId,
        concepto: sale.concepto,
        total: sale.total,
        metodoPago: sale.metodoPago,
        responsable: user.email,
        creadoEn: now
      });

      await auditLog(event, "POS_VENTA_REGISTRAR", "OK", { ventaId, total: sale.total });

      return { message: "Venta registrada", ventaId };
    }
  };
}
