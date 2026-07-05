import { beforeEach, describe, expect, it, vi } from "vitest";
import { lambdaEvent, parseBody } from "../helpers/events.js";

const dynamodbMocks = vi.hoisted(() => ({
  putItem: vi.fn(),
  queryByPk: vi.fn(),
  scanByTipo: vi.fn(),
  scanReservas: vi.fn()
}));

const auditMock = vi.hoisted(() => vi.fn());
const sendReservationEmailMock = vi.hoisted(() => vi.fn());
const cognitoSendMock = vi.hoisted(() => vi.fn());
const publishReservationEventMock = vi.hoisted(() => vi.fn());

const cognitoCommands = vi.hoisted(() => ({
  AdminAddUserToGroupCommand: vi.fn(function AdminAddUserToGroupCommand(input) {
    this.input = input;
  }),
  AdminCreateUserCommand: vi.fn(function AdminCreateUserCommand(input) {
    this.input = input;
  }),
  AdminDeleteUserCommand: vi.fn(function AdminDeleteUserCommand(input) {
    this.input = input;
  }),
  AdminSetUserPasswordCommand: vi.fn(function AdminSetUserPasswordCommand(input) {
    this.input = input;
  })
}));

vi.mock("../../src/lib/dynamodb.js", () => dynamodbMocks);

vi.mock("../../src/lib/audit.js", () => ({
  audit: auditMock
}));

vi.mock("../../src/lib/notifications.js", () => ({
  getSnsRecords: event => event?.Records?.map(record => JSON.parse(record.Sns.Message)) || [],
  sendReservationEmail: sendReservationEmailMock,
  publishReservationEvent: publishReservationEventMock
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: vi.fn(function CognitoIdentityProviderClient() {
    return { send: cognitoSendMock };
  }),
  ...cognitoCommands
}));

vi.mock("uuid", () => ({
  v4: () => "test-id"
}));

const { handler: agendaHandler } = await import("../../src/handlers/gestionAgendaBarbero.js");
const { handler: insumosHandler } = await import("../../src/handlers/gestionInsumos.js");
const { handler: inventarioHandler } = await import("../../src/handlers/gestionInventario.js");
const { handler: negocioHandler } = await import("../../src/handlers/gestionNegocio.js");
const { handler: personalHandler } = await import("../../src/handlers/gestionPersonal.js");
const { handler: lambdaConsumerAdminHandler } = await import("../../src/handlers/lambdaConsumerAdmin.js");
const { handler: lambdaConsumerAvailHandler } = await import("../../src/handlers/lambdaConsumerAvail.js");
const { handler: manageServicesHandler } = await import("../../src/handlers/manageServices.js");
const { handler: misReservasHandler } = await import("../../src/handlers/misReservas.js");
const { handler: notificarReservaHandler } = await import("../../src/handlers/notificarReserva.js");
const { handler: notificarCancelacionHandler } = await import("../../src/handlers/notificarCancelacion.js");
const { handler: postConfirmClienteHandler } = await import("../../src/handlers/postConfirmCliente.js");
const { handler: sqsNotificationConsumerHandler } = await import("../../src/handlers/sqsNotificationConsumer.js");
const { createNuevaReservaHandler } = await import("../../src/handlers/nuevaReserva.js");

describe("handlers operativos del diagrama", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.USER_POOL_ID;
    dynamodbMocks.putItem.mockResolvedValue(undefined);
    dynamodbMocks.queryByPk.mockResolvedValue([]);
    dynamodbMocks.scanByTipo.mockResolvedValue([]);
    dynamodbMocks.scanReservas.mockResolvedValue([]);
    auditMock.mockResolvedValue(undefined);
    sendReservationEmailMock.mockResolvedValue({ sent: true });
    publishReservationEventMock.mockResolvedValue({ MessageId: "msg-1" });
    cognitoSendMock.mockResolvedValue({});
  });

  it("barbero consulta agenda propia desde su perfil", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([{ tipo: "BARBERO", email: "barbero@demo.local", barberoId: "barbero-1" }]);
    dynamodbMocks.queryByPk.mockResolvedValue([{ tipo: "RESERVA", pk: "BARBERO#barbero-1", fecha: "2026-07-10", hora: "09:00" }]);
    const event = lambdaEvent({
      role: "BARBERO",
      user: { sub: "usuario-cognito", email: "barbero@demo.local", name: "Barbero Demo" }
    });

    // Act
    const response = await agendaHandler(event);

    // Assert
    expect(dynamodbMocks.queryByPk).toHaveBeenCalledWith("BARBERO#barbero-1");
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).citas).toHaveLength(1);
  });

  it("administrador consulta agenda global", async () => {
    // Arrange
    dynamodbMocks.scanReservas.mockResolvedValue([
      { tipo: "RESERVA", pk: "CLIENTE#1", fecha: "2026-07-10", hora: "09:00" },
      { tipo: "RESERVA", pk: "BARBERO#1", fecha: "2026-07-10", hora: "09:00" }
    ]);

    // Act
    const response = await agendaHandler(lambdaEvent({ role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).citas).toEqual([{ tipo: "RESERVA", pk: "BARBERO#1", fecha: "2026-07-10", hora: "09:00" }]);
  });

  it("registra consumo de insumo del barbero", async () => {
    // Arrange
    const event = lambdaEvent({
      method: "POST",
      role: "BARBERO",
      user: { sub: "barbero-1", email: "barbero@demo.local" },
      body: { insumoId: "gel", nombre: "Gel", cantidad: 2 }
    });

    // Act
    const response = await insumosHandler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "INSUMO_USO",
      barberoId: "barbero-1",
      cantidad: 2
    }));
  });

  it("lista inventario para secretaria", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([{ tipo: "INVENTARIO", productoId: "prod-1" }]);

    // Act
    const response = await inventarioHandler(lambdaEvent({ role: "SECRETARIA" }));

    // Assert
    expect(dynamodbMocks.scanByTipo).toHaveBeenCalledWith("INVENTARIO");
    expect(parseBody(response).inventario).toHaveLength(1);
  });

  it("registra producto de inventario para secretaria", async () => {
    // Arrange
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      body: { productoId: "prod-1", nombre: "Gel", stock: 10, precio: 25 }
    });

    // Act
    const response = await inventarioHandler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "INVENTARIO",
      productoId: "prod-1",
      stock: 10,
      precio: 25
    }));
  });

  it("rechaza inventario sin datos obligatorios", async () => {
    // Act
    const response = await inventarioHandler(lambdaEvent({ method: "POST", role: "SECRETARIA", body: { nombre: "Gel" } }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "nombre y stock son obligatorios" });
  });

  it("administrador guarda servicio de negocio", async () => {
    // Arrange
    const event = lambdaEvent({
      method: "POST",
      role: "ADMIN",
      body: { servicioId: "fade", nombre: "Fade", precio: 50 }
    });

    // Act
    const response = await negocioHandler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "SERVICIO",
      servicioId: "fade",
      precio: 50
    }));
  });

  it("administrador crea personal interno en Cognito y DynamoDB", async () => {
    // Arrange
    process.env.USER_POOL_ID = "pool-1";
    const event = lambdaEvent({
      method: "POST",
      role: "ADMIN",
      body: { email: "nuevo@demo.local", nombre: "Nuevo", rol: "BARBERO", password: "Temporal123" }
    });

    // Act
    const response = await personalHandler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(cognitoSendMock).toHaveBeenCalledTimes(3);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "BARBERO",
      email: "nuevo@demo.local",
      rol: "BARBERO"
    }));
  });

  it("personal compensa eliminando usuario si falla configuracion Cognito", async () => {
    // Arrange
    process.env.USER_POOL_ID = "pool-1";
    cognitoSendMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("password invalido"))
      .mockResolvedValueOnce({});
    const event = lambdaEvent({
      method: "POST",
      role: "ADMIN",
      body: { email: "fallo@demo.local", nombre: "Fallo", rol: "SECRETARIA", password: "x" }
    });

    // Act
    const response = await personalHandler(event);

    // Assert
    expect(response.statusCode).toBe(500);
    expect(cognitoCommands.AdminDeleteUserCommand).toHaveBeenCalledWith({
      UserPoolId: "pool-1",
      Username: "fallo@demo.local"
    });
    expect(dynamodbMocks.putItem).not.toHaveBeenCalled();
  });

  it("manage services resume servicios e inventario", async () => {
    // Arrange
    dynamodbMocks.scanByTipo
      .mockResolvedValueOnce([{ servicioId: "fade" }])
      .mockResolvedValueOnce([{ productoId: "gel" }, { productoId: "tijera" }]);

    // Act
    const response = await manageServicesHandler({});

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toMatchObject({ servicios: 1, inventario: 2 });
  });

  it("lambda consumer admin rechaza origen no autorizado", async () => {
    // Act
    const response = await lambdaConsumerAdminHandler({ source: "manual.test" });

    // Assert
    expect(response.statusCode).toBe(403);
  });

  it("lambda consumer de disponibilidad procesa eventos de EventBridge", async () => {
    // Act
    const response = await lambdaConsumerAvailHandler({ source: "aws.events" });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(dynamodbMocks.scanByTipo).toHaveBeenCalledWith("SERVICIO");
    expect(dynamodbMocks.scanByTipo).toHaveBeenCalledWith("BARBERO");
  });

  it("lambda consumer de disponibilidad rechaza origen no autorizado", async () => {
    // Act
    const response = await lambdaConsumerAvailHandler({ source: "manual.test" });

    // Assert
    expect(response.statusCode).toBe(403);
  });

  it("cliente lista solo sus reservas", async () => {
    // Arrange
    dynamodbMocks.queryByPk.mockResolvedValue([{ tipo: "RESERVA", reservaId: "res-1" }, { tipo: "CLIENTE" }]);

    // Act
    const response = await misReservasHandler(lambdaEvent({ role: "CLIENTE", user: { sub: "cliente-1" } }));

    // Assert
    expect(dynamodbMocks.queryByPk).toHaveBeenCalledWith("CLIENTE#cliente-1");
    expect(parseBody(response)).toEqual([{ tipo: "RESERVA", reservaId: "res-1" }]);
  });

  it("procesa notificacion SNS de reserva creada", async () => {
    // Arrange
    const event = {
      Records: [{ Sns: { Message: JSON.stringify({ reserva: { clienteCorreo: "cliente@demo.local", fecha: "2026-07-10", hora: "09:00", reservaId: "res-1" } }) } }]
    };

    // Act
    const response = await notificarReservaHandler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(sendReservationEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "cliente@demo.local",
      subject: "Reserva confirmada - BarberCloud"
    }));
  });

  it("procesa notificacion SNS de reserva cancelada", async () => {
    // Arrange
    const event = {
      Records: [{ Sns: { Message: JSON.stringify({ reserva: { clienteCorreo: "cliente@demo.local", fecha: "2026-07-10", hora: "09:00", reservaId: "res-1" } }) } }]
    };

    // Act
    const response = await notificarCancelacionHandler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(sendReservationEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "cliente@demo.local",
      subject: "Reserva cancelada - BarberCloud"
    }));
  });

  it("post confirm agrega cliente a Cognito y registra perfil", async () => {
    // Arrange
    const event = {
      userPoolId: "pool-1",
      userName: "cliente@demo.local",
      request: {
        userAttributes: {
          sub: "cliente-1",
          email: "cliente@demo.local",
          name: "Cliente Demo"
        }
      }
    };

    // Act
    const result = await postConfirmClienteHandler(event);

    // Assert
    expect(result).toBe(event);
    expect(cognitoSendMock).toHaveBeenCalledTimes(1);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CLIENTE#cliente-1",
      tipo: "CLIENTE",
      email: "cliente@demo.local"
    }));
  });

  it("post confirm ignora perfil cuando faltan atributos minimos", async () => {
    // Arrange
    const event = { request: { userAttributes: {} } };

    // Act
    const result = await postConfirmClienteHandler(event);

    // Assert
    expect(result).toBe(event);
    expect(cognitoSendMock).not.toHaveBeenCalled();
    expect(dynamodbMocks.putItem).not.toHaveBeenCalled();
  });

  it("consumer SQS procesa mensaje de reserva cancelada", async () => {
    // Arrange
    const payload = {
      eventType: "RESERVA_CANCELADA",
      reserva: {
        clienteCorreo: "cliente@demo.local",
        fecha: "2026-07-10",
        hora: "09:00",
        reservaId: "res-1"
      }
    };
    const event = {
      Records: [{ body: JSON.stringify({ Type: "Notification", Message: JSON.stringify(payload) }) }]
    };

    // Act
    const response = await sqsNotificationConsumerHandler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(sendReservationEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Reserva cancelada - BarberCloud"
    }));
  });

  it("consumer SQS ignora mensajes sin correo de cliente", async () => {
    // Arrange
    const event = {
      Records: [{ body: JSON.stringify({ reserva: { reservaId: "res-sin-correo" } }) }]
    };

    // Act
    const response = await sqsNotificationConsumerHandler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(sendReservationEmailMock).not.toHaveBeenCalled();
  });
});

describe("nuevaReserva handler", () => {
  const mockService = vi.hoisted(() => ({
    createOnlineReservation: vi.fn()
  }));

  const nuevaReservaHandler = createNuevaReservaHandler(mockService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea reserva exitosamente para cliente", async () => {
    mockService.createOnlineReservation.mockResolvedValue({ reservaId: "res-1" });

    const event = lambdaEvent({
      role: "CLIENTE",
      user: { sub: "cliente-1", email: "cliente@demo.local" }
    });

    const response = await nuevaReservaHandler(event);

    expect(response.statusCode).toBe(201);
    expect(parseBody(response)).toEqual({ reservaId: "res-1" });
  });

  it("devuelve 400 cuando hay ServiceError", async () => {
    const { ServiceError } = await import("../../src/services/errors.js");
    mockService.createOnlineReservation.mockRejectedValue(new ServiceError("Datos invalidos"));

    const event = lambdaEvent({ role: "CLIENTE" });
    const response = await nuevaReservaHandler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Datos invalidos" });
  });

  it("devuelve 400 cuando hay conflicto de horario", async () => {
    mockService.createOnlineReservation.mockRejectedValue({ name: "TransactionCanceledException" });

    const event = lambdaEvent({ role: "CLIENTE" });
    const response = await nuevaReservaHandler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Horario no disponible" });
  });

  it("devuelve 500 en error inesperado", async () => {
    mockService.createOnlineReservation.mockRejectedValue(new Error("DB timeout"));

    const event = lambdaEvent({ role: "CLIENTE" });
    const response = await nuevaReservaHandler(event);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });
});
