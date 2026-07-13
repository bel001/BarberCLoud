import { describe, expect, it, vi } from "vitest";
import { createGestionClientesHandler } from "../../src/handlers/gestionClientes.js";
import { createGestionFinancieraHandler } from "../../src/handlers/gestionFinanciera.js";
import { createGestionPOSHandler } from "../../src/handlers/gestionPOS.js";
import { createGestionCajaHandler } from "../../src/handlers/gestionCaja.js";
import { createCancelarReservaHandler } from "../../src/handlers/cancelarReserva.js";
import { createConsultarDisponibilidadHandler } from "../../src/handlers/consultarDisponibilidad.js";
import { ServiceError } from "../../src/services/errors.js";
import { lambdaEvent, parseBody } from "../helpers/events.js";

// Pruebas de integracion ligera: validan que cada handler traduzca
// reglas de servicio en respuestas HTTP correctas sin invocar AWS real.
describe("handlers integration con servicios inyectados", () => {
  it("bloquea POS si el usuario no tiene rol interno", async () => {
    const handler = createGestionPOSHandler({
      listSales: vi.fn(),
      registerSale: vi.fn()
    });
    const event = lambdaEvent({ method: "GET", role: "CLIENTE" });

    const response = await handler(event);

    expect(response.statusCode).toBe(403);
    expect(parseBody(response)).toEqual({ error: "Acceso no autorizado" });
  });

  it("registra venta por POS con respuesta 201", async () => {
    const service = {
      listSales: vi.fn(),
      registerSale: vi.fn().mockResolvedValue({ message: "Venta registrada", ventaId: "venta_1" })
    };
    const handler = createGestionPOSHandler(service);
    const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: { concepto: "Corte", total: 30 } });

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual({ message: "Venta registrada", ventaId: "venta_1" });
  });

  it("lista ventas de POS con respuesta 200", async () => {
    const service = {
      listSales: vi.fn().mockResolvedValue({ ventas: [{ ventaId: "venta_1" }], total: 30 }),
      registerSale: vi.fn()
    };
    const handler = createGestionPOSHandler(service);

    const response = await handler(lambdaEvent({ method: "GET", role: "SECRETARIA" }));

    expect(service.listSales).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ ventas: [{ ventaId: "venta_1" }], total: 30 });
  });

  it("devuelve validacion de POS como bad request", async () => {
    const service = {
      listSales: vi.fn(),
      registerSale: vi.fn().mockRejectedValue(new ServiceError("concepto y total son obligatorios"))
    };
    const handler = createGestionPOSHandler(service);
    const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: {} });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "concepto y total son obligatorios" });
  });

  it("mapea error inesperado de POS a 500", async () => {
    const service = {
      listSales: vi.fn().mockRejectedValue(new Error("fallo caja")),
      registerSale: vi.fn()
    };
    const handler = createGestionPOSHandler(service);

    const response = await handler(lambdaEvent({ method: "GET", role: "SECRETARIA" }));

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });

  it("abre caja mediante el handler de gestion de caja", async () => {
    const service = {
      abrirCaja: vi.fn().mockResolvedValue({ message: "Caja abierta correctamente", sesionId: "sesion_1", montoInicial: 50 }),
      cerrarCaja: vi.fn()
    };
    const handler = createGestionCajaHandler(service);
    const event = lambdaEvent({ method: "POST", rawPath: "/secretaria/caja/abrir", role: "SECRETARIA", body: { montoInicial: 50 } });

    const response = await handler(event);

    expect(service.abrirCaja).toHaveBeenCalledWith(event);
    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual({ message: "Caja abierta correctamente", sesionId: "sesion_1", montoInicial: 50 });
  });

  it("cierra caja mediante el handler de gestion de caja", async () => {
    const service = {
      abrirCaja: vi.fn(),
      cerrarCaja: vi.fn().mockResolvedValue({ message: "Caja cerrada correctamente", montoEsperado: 130, montoContado: 125, diferencia: -5 })
    };
    const handler = createGestionCajaHandler(service);
    const event = lambdaEvent({ method: "POST", rawPath: "/secretaria/caja/cerrar", role: "SECRETARIA", body: { montoContado: 125 } });

    const response = await handler(event);

    expect(service.cerrarCaja).toHaveBeenCalledWith(event);
    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual({ message: "Caja cerrada correctamente", montoEsperado: 130, montoContado: 125, diferencia: -5 });
  });

  it("mapea error de validacion de caja a bad request", async () => {
    const service = {
      abrirCaja: vi.fn().mockRejectedValue(new ServiceError("Ya existe una caja abierta para hoy")),
      cerrarCaja: vi.fn()
    };
    const handler = createGestionCajaHandler(service);
    const event = lambdaEvent({ method: "POST", rawPath: "/secretaria/caja/abrir", role: "SECRETARIA", body: {} });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Ya existe una caja abierta para hoy" });
  });

  it("finanzas solo permite administrador y devuelve reporte", async () => {
    const service = {
      getReport: vi.fn().mockResolvedValue({ totalReservas: 2, online: 1, presenciales: 1, ingresosEstimados: 50 })
    };
    const handler = createGestionFinancieraHandler(service);
    const event = lambdaEvent({ method: "GET", role: "ADMIN" });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      totalReservas: 2,
      online: 1,
      presenciales: 1,
      ingresosEstimados: 50
    });
  });

  it("finanzas devuelve el dashboard financiero completo en la ruta dedicada", async () => {
    const service = {
      getDashboard: vi.fn().mockResolvedValue({
        totalReservas: 2,
        ingresosEstimados: 50,
        ingresosNetos: 40,
        ingresosPorMes: [{ mes: "2026-07", ingresos: 50 }],
        gananciasPorBarbero: [{ barberoId: "barbero_carlos", ganancias: 50 }],
        valorInventario: 200,
        costosInsumos: 10
      })
    };
    const handler = createGestionFinancieraHandler(service);
    const event = lambdaEvent({ method: "GET", role: "ADMIN", rawPath: "/admin/dashboard-financiero" });

    const response = await handler(event);

    expect(service.getDashboard).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).ingresosNetos).toBe(40);
  });

  it("mapea error de finanzas a error interno", async () => {
    const service = {
      getReport: vi.fn().mockRejectedValue(new Error("fallo reporte"))
    };
    const handler = createGestionFinancieraHandler(service);

    const response = await handler(lambdaEvent({ method: "GET", role: "ADMIN" }));

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });

  it("secretaria registra un cliente rapido", async () => {
    const repository = {
      findClienteByEmail: vi.fn().mockResolvedValue(null),
      putItem: vi.fn().mockResolvedValue(undefined)
    };
    const auditLog = vi.fn().mockResolvedValue(undefined);
    const handler = createGestionClientesHandler({ service: { createPresentialReservation: vi.fn() }, repository, auditLog });
    const event = lambdaEvent({
      method: "POST",
      rawPath: "/secretaria/clientes",
      role: "SECRETARIA",
      body: { nombre: "Nuevo Cliente", email: "nuevo@demo.local", telefono: "999999999" }
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    expect(parseBody(response).message).toBe("Cliente registrado correctamente");
    expect(repository.putItem).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "CLIENTE",
      nombre: "Nuevo Cliente",
      email: "nuevo@demo.local",
      telefono: "999999999"
    }));
    expect(auditLog).toHaveBeenCalled();
  });

  it("secretaria no puede registrar un cliente con correo duplicado", async () => {
    const repository = {
      findClienteByEmail: vi.fn().mockResolvedValue({ clienteId: "cliente-1" })
    };
    const handler = createGestionClientesHandler({ service: {}, repository, auditLog: vi.fn() });
    const event = lambdaEvent({
      method: "POST",
      rawPath: "/secretaria/clientes",
      role: "SECRETARIA",
      body: { nombre: "Duplicado", email: "existe@demo.local" }
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Ya existe un cliente registrado con ese correo" });
  });

  it("secretaria recibe validacion al registrar cliente sin nombre o email", async () => {
    const handler = createGestionClientesHandler({ service: {}, repository: {}, auditLog: vi.fn() });
    const event = lambdaEvent({ method: "POST", rawPath: "/secretaria/clientes", role: "SECRETARIA", body: {} });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "nombre y email son obligatorios" });
  });

  it("secretaria consulta el historial de reservas de un cliente", async () => {
    const repository = {
      queryByPk: vi.fn().mockResolvedValue([
        { tipo: "RESERVA", reservaId: "res_1" },
        { tipo: "CLIENTE" }
      ])
    };
    const handler = createGestionClientesHandler({ service: {}, repository, auditLog: vi.fn() });
    const event = lambdaEvent({
      method: "GET",
      rawPath: "/secretaria/clientes/cliente-1/historial",
      pathParameters: { id: "cliente-1" },
      role: "SECRETARIA"
    });

    const response = await handler(event);

    expect(repository.queryByPk).toHaveBeenCalledWith("CLIENTE#cliente-1");
    expect(parseBody(response)).toEqual({ reservas: [{ tipo: "RESERVA", reservaId: "res_1" }] });
  });

  it("secretaria lista clientes desde repositorio", async () => {
    const repository = {
      scanByTipo: vi.fn().mockResolvedValue([{ clienteId: "cliente-1", email: "cliente@demo.local" }])
    };
    const service = {
      createPresentialReservation: vi.fn()
    };
    const handler = createGestionClientesHandler({ service, repository });
    const event = lambdaEvent({ method: "GET", rawPath: "/secretaria/clientes", role: "SECRETARIA" });

    const response = await handler(event);

    expect(repository.scanByTipo).toHaveBeenCalledWith("CLIENTE");
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      clientes: [{ clienteId: "cliente-1", email: "cliente@demo.local" }]
    });
  });

  it("secretaria crea reserva presencial y conserva estado 201", async () => {
    const repository = { scanByTipo: vi.fn() };
    const service = {
      createPresentialReservation: vi.fn().mockResolvedValue({
        message: "Cita presencial registrada para cliente existente",
        reservaId: "res_1",
        clienteId: "cliente-1"
      })
    };
    const handler = createGestionClientesHandler({ service, repository });
    const event = lambdaEvent({
      method: "POST",
      rawPath: "/secretaria/reservas-presenciales",
      role: "SECRETARIA",
      body: {}
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual({
      message: "Cita presencial registrada para cliente existente",
      reservaId: "res_1",
      clienteId: "cliente-1"
    });
  });

  it("secretaria recibe error por operacion de clientes no soportada", async () => {
    const handler = createGestionClientesHandler({
      service: { createPresentialReservation: vi.fn() },
      repository: { scanByTipo: vi.fn() }
    });
    const event = lambdaEvent({ method: "DELETE", rawPath: "/secretaria/clientes", role: "SECRETARIA" });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Operacion no soportada" });
  });

  it("secretaria recibe validacion de reserva presencial", async () => {
    const handler = createGestionClientesHandler({
      service: { createPresentialReservation: vi.fn().mockRejectedValue(new ServiceError("clienteCorreo es obligatorio")) },
      repository: { scanByTipo: vi.fn() }
    });
    const event = lambdaEvent({ method: "POST", rawPath: "/secretaria/reservas-presenciales", role: "SECRETARIA" });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "clienteCorreo es obligatorio" });
  });

  it("secretaria recibe conflicto de horario en reserva presencial", async () => {
    const handler = createGestionClientesHandler({
      service: { createPresentialReservation: vi.fn().mockRejectedValue({ name: "TransactionCanceledException" }) },
      repository: { scanByTipo: vi.fn() }
    });
    const event = lambdaEvent({ method: "POST", rawPath: "/secretaria/reservas-presenciales", role: "SECRETARIA" });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Horario no disponible" });
  });

  it("secretaria recibe error interno si falla repositorio de clientes", async () => {
    const handler = createGestionClientesHandler({
      service: { createPresentialReservation: vi.fn() },
      repository: { scanByTipo: vi.fn().mockRejectedValue(new Error("fallo db")) }
    });
    const event = lambdaEvent({ method: "GET", rawPath: "/secretaria/clientes", role: "SECRETARIA" });

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });

  it("consulta disponibilidad publica desde servicio inyectado", async () => {
    const service = {
      getAvailability: vi.fn().mockResolvedValue({
        fecha: "2026-07-10",
        servicios: [],
        barberos: [],
        horarios: [],
        disponibilidad: {}
      })
    };
    const handler = createConsultarDisponibilidadHandler(service);
    const event = lambdaEvent({ method: "GET", queryStringParameters: { fecha: "2026-07-10" } });

    const response = await handler(event);

    expect(service.getAvailability).toHaveBeenCalledWith(event);
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).fecha).toBe("2026-07-10");
  });

  it("mapea error de disponibilidad a error interno", async () => {
    const service = {
      getAvailability: vi.fn().mockRejectedValue(new Error("fallo repositorio"))
    };
    const handler = createConsultarDisponibilidadHandler(service);

    const response = await handler(lambdaEvent({ method: "GET" }));

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });

  it("cancela reserva desde handler de cliente", async () => {
    const service = {
      cancelReservation: vi.fn().mockResolvedValue({
        message: "Reserva cancelada correctamente",
        reservaId: "res_1"
      })
    };
    const handler = createCancelarReservaHandler(service);
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_1" } });

    const response = await handler(event);

    expect(service.cancelReservation).toHaveBeenCalledWith(event);
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      message: "Reserva cancelada correctamente",
      reservaId: "res_1"
    });
  });

  it("devuelve bad request al cancelar sin reservaId", async () => {
    const service = {
      cancelReservation: vi.fn().mockRejectedValue(new ServiceError("reservaId es obligatorio"))
    };
    const handler = createCancelarReservaHandler(service);

    const response = await handler(lambdaEvent({ method: "POST" }));

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "reservaId es obligatorio" });
  });

  it("mapea error inesperado al cancelar reserva", async () => {
    const service = {
      cancelReservation: vi.fn().mockRejectedValue(new Error("fallo cancelacion"))
    };
    const handler = createCancelarReservaHandler(service);

    const response = await handler(lambdaEvent({ method: "POST", pathParameters: { id: "res_1" } }));

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });
});
