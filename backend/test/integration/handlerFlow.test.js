import { describe, expect, it, vi } from "vitest";
import { createGestionClientesHandler } from "../../src/handlers/gestionClientes.js";
import { createGestionFinancieraHandler } from "../../src/handlers/gestionFinanciera.js";
import { createGestionPOSHandler } from "../../src/handlers/gestionPOS.js";
import { createCancelarReservaHandler } from "../../src/handlers/cancelarReserva.js";
import { createConsultarDisponibilidadHandler } from "../../src/handlers/consultarDisponibilidad.js";
import { ServiceError } from "../../src/services/errors.js";
import { lambdaEvent, parseBody } from "../helpers/events.js";

describe("handlers integration con servicios inyectados", () => {
  it("bloquea POS si el usuario no tiene rol interno", async () => {
    // Arrange
    const handler = createGestionPOSHandler({
      listSales: vi.fn(),
      registerSale: vi.fn()
    });
    const event = lambdaEvent({ method: "GET", role: "CLIENTE" });

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(403);
    expect(parseBody(response)).toEqual({ error: "Acceso no autorizado" });
  });

  it("registra venta por POS con respuesta 201", async () => {
    // Arrange
    const service = {
      listSales: vi.fn(),
      registerSale: vi.fn().mockResolvedValue({ message: "Venta registrada", ventaId: "venta_1" })
    };
    const handler = createGestionPOSHandler(service);
    const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: { concepto: "Corte", total: 30 } });

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual({ message: "Venta registrada", ventaId: "venta_1" });
  });

  it("devuelve validacion de POS como bad request", async () => {
    // Arrange
    const service = {
      listSales: vi.fn(),
      registerSale: vi.fn().mockRejectedValue(new ServiceError("concepto y total son obligatorios"))
    };
    const handler = createGestionPOSHandler(service);
    const event = lambdaEvent({ method: "POST", role: "SECRETARIA", body: {} });

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "concepto y total son obligatorios" });
  });

  it("finanzas solo permite administrador y devuelve reporte", async () => {
    // Arrange
    const service = {
      getReport: vi.fn().mockResolvedValue({ totalReservas: 2, online: 1, presenciales: 1, ingresosEstimados: 50 })
    };
    const handler = createGestionFinancieraHandler(service);
    const event = lambdaEvent({ method: "GET", role: "ADMIN" });

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      totalReservas: 2,
      online: 1,
      presenciales: 1,
      ingresosEstimados: 50
    });
  });

  it("secretaria lista clientes desde repositorio", async () => {
    // Arrange
    const repository = {
      scanByTipo: vi.fn().mockResolvedValue([{ clienteId: "cliente-1", email: "cliente@demo.local" }])
    };
    const service = {
      createPresentialReservation: vi.fn()
    };
    const handler = createGestionClientesHandler({ service, repository });
    const event = lambdaEvent({ method: "GET", rawPath: "/secretaria/clientes", role: "SECRETARIA" });

    // Act
    const response = await handler(event);

    // Assert
    expect(repository.scanByTipo).toHaveBeenCalledWith("CLIENTE");
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      clientes: [{ clienteId: "cliente-1", email: "cliente@demo.local" }]
    });
  });

  it("secretaria crea reserva presencial y conserva estado 201", async () => {
    // Arrange
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

    // Act
    const response = await handler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual({
      message: "Cita presencial registrada para cliente existente",
      reservaId: "res_1",
      clienteId: "cliente-1"
    });
  });

  it("consulta disponibilidad publica desde servicio inyectado", async () => {
    // Arrange
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

    // Act
    const response = await handler(event);

    // Assert
    expect(service.getAvailability).toHaveBeenCalledWith(event);
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).fecha).toBe("2026-07-10");
  });

  it("mapea error de disponibilidad a error interno", async () => {
    // Arrange
    const service = {
      getAvailability: vi.fn().mockRejectedValue(new Error("fallo repositorio"))
    };
    const handler = createConsultarDisponibilidadHandler(service);

    // Act
    const response = await handler(lambdaEvent({ method: "GET" }));

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });

  it("cancela reserva desde handler de cliente", async () => {
    // Arrange
    const service = {
      cancelReservation: vi.fn().mockResolvedValue({
        message: "Reserva cancelada correctamente",
        reservaId: "res_1"
      })
    };
    const handler = createCancelarReservaHandler(service);
    const event = lambdaEvent({ method: "POST", pathParameters: { id: "res_1" } });

    // Act
    const response = await handler(event);

    // Assert
    expect(service.cancelReservation).toHaveBeenCalledWith(event);
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      message: "Reserva cancelada correctamente",
      reservaId: "res_1"
    });
  });

  it("devuelve bad request al cancelar sin reservaId", async () => {
    // Arrange
    const service = {
      cancelReservation: vi.fn().mockRejectedValue(new ServiceError("reservaId es obligatorio"))
    };
    const handler = createCancelarReservaHandler(service);

    // Act
    const response = await handler(lambdaEvent({ method: "POST" }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "reservaId es obligatorio" });
  });
});
