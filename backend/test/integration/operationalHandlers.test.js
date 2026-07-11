import { beforeEach, describe, expect, it, vi } from "vitest";
import { lambdaEvent, parseBody } from "../helpers/events.js";

const dynamodbMocks = vi.hoisted(() => ({
  putItem: vi.fn(),
  getItem: vi.fn(),
  queryByPk: vi.fn(),
  scanByTipo: vi.fn(),
  scanReservas: vi.fn()
}));

const auditMock = vi.hoisted(() => vi.fn());
const sendReservationEmailMock = vi.hoisted(() => vi.fn());
const cognitoSendMock = vi.hoisted(() => vi.fn());
const publishReservationEventMock = vi.hoisted(() => vi.fn());
const nuevaReservaServiceMock = vi.hoisted(() => ({
  createOnlineReservation: vi.fn()
}));

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
  AdminDisableUserCommand: vi.fn(function AdminDisableUserCommand(input) {
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
const { handler: cuentaHandler } = await import("../../src/handlers/gestionCuenta.js");
const { handler: actividadHandler } = await import("../../src/handlers/gestionActividad.js");
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
    dynamodbMocks.getItem.mockResolvedValue(null);
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
      { tipo: "RESERVA", pk: "BARBERO#1", fecha: "2026-07-10", hora: "11:00" },
      { tipo: "RESERVA", pk: "BARBERO#1", fecha: "2026-07-10", hora: "09:00" }
    ]);

    // Act
    const response = await agendaHandler(lambdaEvent({ role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).citas).toEqual([
      { tipo: "RESERVA", pk: "BARBERO#1", fecha: "2026-07-10", hora: "09:00" },
      { tipo: "RESERVA", pk: "BARBERO#1", fecha: "2026-07-10", hora: "11:00" }
    ]);
  });

  it("barbero usa sub cuando no existe perfil registrado", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([]);
    dynamodbMocks.queryByPk.mockResolvedValue([]);

    // Act
    const response = await agendaHandler(lambdaEvent({
      role: "BARBERO",
      user: { sub: "barbero-sub", email: "sin-perfil@demo.local" }
    }));

    // Assert
    expect(response.statusCode).toBe(200);
    expect(dynamodbMocks.queryByPk).toHaveBeenCalledWith("BARBERO#barbero-sub");
  });

  it("barbero usa id por defecto cuando no hay perfil ni sub", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([]);
    dynamodbMocks.queryByPk.mockResolvedValue([]);
    const event = {
      requestContext: {
        http: { method: "GET" },
        authorizer: {
          jwt: {
            claims: {
              email: "sin-sub@demo.local",
              role: "BARBERO"
            }
          }
        }
      }
    };

    // Act
    const response = await agendaHandler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(dynamodbMocks.queryByPk).toHaveBeenCalledWith("BARBERO#barbero_carlos");
  });

  it("mapea error de agenda a 500", async () => {
    // Arrange
    dynamodbMocks.scanReservas.mockRejectedValue(new Error("fallo agenda"));

    // Act
    const response = await agendaHandler(lambdaEvent({ role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
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

  it("lista todos los consumos de insumos para administrador", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([
      { tipo: "INSUMO_USO", barberoId: "barbero-1" },
      { tipo: "INSUMO_USO", barberoId: "barbero-2" }
    ]);

    // Act
    const response = await insumosHandler(lambdaEvent({ role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).insumos).toHaveLength(2);
  });

  it("lista solo consumos del barbero autenticado", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([
      { tipo: "INSUMO_USO", barberoId: "barbero-1" },
      { tipo: "INSUMO_USO", barberoId: "barbero-2" }
    ]);

    // Act
    const response = await insumosHandler(lambdaEvent({
      role: "BARBERO",
      user: { sub: "barbero-1", email: "barbero@demo.local" }
    }));

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).insumos).toEqual([{ tipo: "INSUMO_USO", barberoId: "barbero-1" }]);
  });

  it("rechaza consumo de insumo sin datos obligatorios", async () => {
    // Act
    const response = await insumosHandler(lambdaEvent({
      method: "POST",
      role: "BARBERO",
      body: { insumoId: "gel" }
    }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "insumoId, nombre y cantidad son obligatorios" });
  });

  it("rechaza consumo de insumo sin body", async () => {
    // Act
    const response = await insumosHandler(lambdaEvent({ method: "POST", role: "BARBERO" }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "insumoId, nombre y cantidad son obligatorios" });
  });

  it("mapea error de insumos a 500", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockRejectedValue(new Error("fallo insumos"));

    // Act
    const response = await insumosHandler(lambdaEvent({ role: "BARBERO" }));

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
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

  it("registra producto con id autogenerado y precio cero por defecto", async () => {
    // Arrange
    const event = lambdaEvent({
      method: "POST",
      role: "SECRETARIA",
      body: { nombre: "Cera", stock: 5 }
    });

    // Act
    const response = await inventarioHandler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      productoId: "prod_test-id",
      precio: 0
    }));
  });

  it("rechaza inventario sin datos obligatorios", async () => {
    // Act
    const response = await inventarioHandler(lambdaEvent({ method: "POST", role: "SECRETARIA", body: { nombre: "Gel" } }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "nombre y stock son obligatorios" });
  });

  it("rechaza inventario sin body", async () => {
    // Act
    const response = await inventarioHandler(lambdaEvent({ method: "POST", role: "SECRETARIA" }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "nombre y stock son obligatorios" });
  });

  it("mapea error de inventario a 500", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockRejectedValue(new Error("fallo inventario"));

    // Act
    const response = await inventarioHandler(lambdaEvent({ role: "SECRETARIA" }));

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
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

  it("administrador lista servicios de negocio", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([{ servicioId: "fade", nombre: "Fade" }]);

    // Act
    const response = await negocioHandler(lambdaEvent({ role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ servicios: [{ servicioId: "fade", nombre: "Fade" }] });
  });

  it("administrador guarda servicio con id y duracion por defecto", async () => {
    // Arrange
    const event = lambdaEvent({
      method: "POST",
      role: "ADMIN",
      body: { nombre: "Barba", precio: 20 }
    });

    // Act
    const response = await negocioHandler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      servicioId: "servicio_test-id",
      duracionMinutos: 45,
      estado: "ACTIVO"
    }));
  });

  it("rechaza servicio sin nombre o precio", async () => {
    // Act
    const response = await negocioHandler(lambdaEvent({
      method: "POST",
      role: "ADMIN",
      body: { nombre: "Barba" }
    }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "nombre y precio son obligatorios" });
  });

  it("rechaza servicio sin body", async () => {
    // Act
    const response = await negocioHandler(lambdaEvent({ method: "POST", role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "nombre y precio son obligatorios" });
  });

  it("administrador consulta el flujo de actividad reciente", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockResolvedValue([
      { tipo: "AUDIT_LOG", action: "RESERVA_CREAR", creadoEn: "2026-07-01T10:00:00.000Z" },
      { tipo: "AUDIT_LOG", action: "RESERVA_CANCELAR", creadoEn: "2026-07-02T10:00:00.000Z" }
    ]);

    // Act
    const response = await actividadHandler(lambdaEvent({ role: "ADMIN" }));

    // Assert
    expect(dynamodbMocks.scanByTipo).toHaveBeenCalledWith("AUDIT_LOG");
    expect(parseBody(response).actividad[0].action).toBe("RESERVA_CANCELAR");
  });

  it("mapea error de negocio a 500", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockRejectedValue(new Error("fallo negocio"));

    // Act
    const response = await negocioHandler(lambdaEvent({ role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
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

  it("rechaza crear personal sin campos obligatorios", async () => {
    // Act
    const response = await personalHandler(lambdaEvent({ method: "POST", role: "ADMIN", body: { email: "x@demo.local" } }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "email, nombre, rol y password son obligatorios" });
  });

  it("rechaza crear personal sin body", async () => {
    // Act
    const response = await personalHandler(lambdaEvent({ method: "POST", role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "email, nombre, rol y password son obligatorios" });
  });

  it("crea usuario interno sin Cognito cuando no hay user pool", async () => {
    // Arrange
    const event = lambdaEvent({
      method: "POST",
      role: "ADMIN",
      body: { userId: "secretaria-1", email: "sec@demo.local", nombre: "Sec", rol: "SECRETARIA", password: "Temporal123" }
    });

    // Act
    const response = await personalHandler(event);

    // Assert
    expect(response.statusCode).toBe(201);
    expect(cognitoSendMock).not.toHaveBeenCalled();
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "USUARIO_INTERNO",
      userId: "secretaria-1",
      rol: "SECRETARIA"
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

  it("administrador lista el personal (barberos y usuarios internos)", async () => {
    // Arrange
    dynamodbMocks.scanByTipo
      .mockResolvedValueOnce([{ tipo: "BARBERO", nombre: "Carlos" }])
      .mockResolvedValueOnce([{ tipo: "USUARIO_INTERNO", nombre: "Secretaria Demo" }]);

    // Act
    const response = await personalHandler(lambdaEvent({ method: "GET", role: "ADMIN" }));

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({
      personal: [{ tipo: "BARBERO", nombre: "Carlos" }, { tipo: "USUARIO_INTERNO", nombre: "Secretaria Demo" }]
    });
  });

  it("administrador da de baja a un usuario y lo deshabilita en Cognito", async () => {
    // Arrange
    process.env.USER_POOL_ID = "pool-1";
    dynamodbMocks.getItem.mockResolvedValue({
      pk: "BARBERO#barbero-1",
      sk: "PROFILE",
      nombre: "Carlos",
      email: "carlos@demo.local",
      rol: "BARBERO",
      estado: "ACTIVO"
    });
    const event = lambdaEvent({
      method: "POST",
      rawPath: "/admin/personal/barbero-1/baja",
      role: "ADMIN",
      body: { userId: "barbero-1", rol: "BARBERO" }
    });

    // Act
    const response = await personalHandler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ message: "Usuario dado de baja correctamente", userId: "barbero-1" });
    expect(cognitoCommands.AdminDisableUserCommand).toHaveBeenCalledWith({
      UserPoolId: "pool-1",
      Username: "carlos@demo.local"
    });
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      nombre: "Carlos",
      estado: "INACTIVO"
    }));
  });

  it("rechaza dar de baja a un usuario inexistente", async () => {
    // Arrange
    dynamodbMocks.getItem.mockResolvedValue(null);
    const event = lambdaEvent({
      method: "POST",
      rawPath: "/admin/personal/barbero-1/baja",
      role: "ADMIN",
      body: { userId: "barbero-1", rol: "BARBERO" }
    });

    // Act
    const response = await personalHandler(event);

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Usuario no encontrado" });
  });

  it("rechaza dar de baja sin userId o rol", async () => {
    // Act
    const response = await personalHandler(lambdaEvent({ method: "POST", rawPath: "/admin/personal/x/baja", role: "ADMIN", body: {} }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "userId y rol son obligatorios" });
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

  it("manage services mapea errores de repositorio", async () => {
    // Arrange
    dynamodbMocks.scanByTipo.mockRejectedValue(new Error("fallo configuracion"));

    // Act
    const response = await manageServicesHandler({});

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });

  it("lambda consumer admin procesa origen EventBridge por defecto", async () => {
    // Act
    const response = await lambdaConsumerAdminHandler({});

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ message: "Proceso administrativo ejecutado" });
  });

  it("lambda consumer admin procesa origen SNS", async () => {
    // Act
    const response = await lambdaConsumerAdminHandler({ source: "aws.sns" });

    // Assert
    expect(response.statusCode).toBe(200);
  });

  it("lambda consumer admin rechaza origen no autorizado", async () => {
    // Act
    const response = await lambdaConsumerAdminHandler({ source: "manual.test" });

    // Assert
    expect(response.statusCode).toBe(403);
  });

  it("lambda consumer de disponibilidad procesa origen SNS de registros", async () => {
    // Act
    const response = await lambdaConsumerAvailHandler({ Records: [{ EventSource: "aws.sns" }] });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ message: "Disponibilidad refrescada" });
  });

  it("lambda consumer de disponibilidad usa EventBridge por defecto", async () => {
    // Act
    const response = await lambdaConsumerAvailHandler({});

    // Assert
    expect(response.statusCode).toBe(200);
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

  it("cliente lista solo sus reservas junto con sus puntos de lealtad", async () => {
    // Arrange
    dynamodbMocks.queryByPk.mockResolvedValue([{ tipo: "RESERVA", reservaId: "res-1" }, { tipo: "CLIENTE", puntos: 30 }]);

    // Act
    const response = await misReservasHandler(lambdaEvent({ role: "CLIENTE", user: { sub: "cliente-1" } }));

    // Assert
    expect(dynamodbMocks.queryByPk).toHaveBeenCalledWith("CLIENTE#cliente-1");
    expect(parseBody(response)).toEqual({ reservas: [{ tipo: "RESERVA", reservaId: "res-1" }], canjes: [], puntos: 30 });
  });

  it("cliente sin perfil de puntos aun ve 0", async () => {
    // Arrange
    dynamodbMocks.queryByPk.mockResolvedValue([{ tipo: "RESERVA", reservaId: "res-1" }]);

    // Act
    const response = await misReservasHandler(lambdaEvent({ role: "CLIENTE", user: { sub: "cliente-1" } }));

    // Assert
    expect(parseBody(response)).toEqual({ reservas: [{ tipo: "RESERVA", reservaId: "res-1" }], canjes: [], puntos: 0 });
  });

  it("cliente ve su historial de canjes de recompensas", async () => {
    // Arrange
    dynamodbMocks.queryByPk.mockResolvedValue([
      { tipo: "CANJE", codigo: "CANJE-ABC12345", puntosUsados: 100 },
      { tipo: "CLIENTE", puntos: 10 }
    ]);

    // Act
    const response = await misReservasHandler(lambdaEvent({ role: "CLIENTE", user: { sub: "cliente-1" } }));

    // Assert
    expect(parseBody(response)).toEqual({ reservas: [], canjes: [{ tipo: "CANJE", codigo: "CANJE-ABC12345", puntosUsados: 100 }], puntos: 10 });
  });

  it("cliente obtiene sus datos de cuenta", async () => {
    // Arrange
    dynamodbMocks.getItem.mockResolvedValue({ nombre: "Cliente Demo", email: "cliente@demo.local", puntos: 40 });

    // Act
    const response = await cuentaHandler(lambdaEvent({ method: "GET", role: "CLIENTE", user: { sub: "cliente-1" } }));

    // Assert
    expect(dynamodbMocks.getItem).toHaveBeenCalledWith("CLIENTE#cliente-1", "PROFILE");
    expect(parseBody(response)).toEqual({ nombre: "Cliente Demo", email: "cliente@demo.local" });
  });

  it("cliente sin perfil ve los datos de su sesion JWT", async () => {
    // Arrange
    dynamodbMocks.getItem.mockResolvedValue(null);

    // Act
    const response = await cuentaHandler(lambdaEvent({ method: "GET", role: "CLIENTE", user: { sub: "cliente-1", name: "Cliente JWT", email: "jwt@demo.local" } }));

    // Assert
    expect(parseBody(response)).toEqual({ nombre: "Cliente JWT", email: "jwt@demo.local" });
  });

  it("cliente actualiza su nombre sin perder los puntos existentes", async () => {
    // Arrange
    dynamodbMocks.getItem.mockResolvedValue({ nombre: "Viejo Nombre", email: "cliente@demo.local", puntos: 40 });

    // Act
    const response = await cuentaHandler(lambdaEvent({ method: "PUT", role: "CLIENTE", user: { sub: "cliente-1" }, body: { nombre: "Nombre Nuevo" } }));

    // Assert
    expect(parseBody(response)).toEqual({ message: "Datos actualizados correctamente", nombre: "Nombre Nuevo" });
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CLIENTE#cliente-1",
      nombre: "Nombre Nuevo",
      puntos: 40
    }));
  });

  it("rechaza actualizar cuenta sin nombre", async () => {
    // Act
    const response = await cuentaHandler(lambdaEvent({ method: "PUT", role: "CLIENTE", user: { sub: "cliente-1" }, body: {} }));

    // Assert
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "nombre es obligatorio" });
  });

  it("cliente recibe error interno si falla listado de reservas", async () => {
    // Arrange
    dynamodbMocks.queryByPk.mockRejectedValue(new Error("fallo reservas"));

    // Act
    const response = await misReservasHandler(lambdaEvent({ role: "CLIENTE", user: { sub: "cliente-1" } }));

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
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

  it("procesa notificacion de reserva creada sin wrapper reserva", async () => {
    // Arrange
    const event = {
      Records: [{ Sns: { Message: JSON.stringify({ clienteCorreo: "cliente@demo.local", fecha: "2026-07-10", hora: "09:00", reservaId: "res-1" }) } }]
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

  it("mapea error de notificacion de reserva", async () => {
    // Arrange
    sendReservationEmailMock.mockRejectedValue(new Error("fallo correo"));
    const event = {
      Records: [{ Sns: { Message: JSON.stringify({ reserva: { clienteCorreo: "cliente@demo.local" } }) } }]
    };

    // Act
    const response = await notificarReservaHandler(event);

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
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

  it("procesa notificacion de cancelacion sin wrapper reserva", async () => {
    // Arrange
    const event = {
      Records: [{ Sns: { Message: JSON.stringify({ clienteCorreo: "cliente@demo.local", fecha: "2026-07-10", hora: "09:00", reservaId: "res-1" }) } }]
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

  it("mapea error de notificacion de cancelacion", async () => {
    // Arrange
    sendReservationEmailMock.mockRejectedValue(new Error("fallo correo"));
    const event = {
      Records: [{ Sns: { Message: JSON.stringify({ reserva: { clienteCorreo: "cliente@demo.local" } }) } }]
    };

    // Act
    const response = await notificarCancelacionHandler(event);

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
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

  it("post confirm ignora evento sin request", async () => {
    // Act
    const result = await postConfirmClienteHandler({});

    // Assert
    expect(result).toEqual({});
    expect(cognitoSendMock).not.toHaveBeenCalled();
    expect(dynamodbMocks.putItem).not.toHaveBeenCalled();
  });

  it("post confirm usa userName y nombre por defecto cuando faltan sub y name", async () => {
    // Arrange
    const event = {
      userName: "cliente@demo.local",
      request: {
        userAttributes: {
          email: "cliente@demo.local"
        }
      }
    };

    // Act
    const result = await postConfirmClienteHandler(event);

    // Assert
    expect(result).toBe(event);
    expect(dynamodbMocks.putItem).toHaveBeenCalledWith(expect.objectContaining({
      pk: "CLIENTE#cliente@demo.local",
      nombre: "cliente@demo.local"
    }));
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

  it("consumer SQS procesa mensaje directo de reserva confirmada", async () => {
    // Arrange
    const event = {
      Records: [{
        body: JSON.stringify({
          clienteCorreo: "cliente@demo.local",
          fecha: "2026-07-10",
          hora: "09:00",
          reservaId: "res-1"
        })
      }]
    };

    // Act
    const response = await sqsNotificationConsumerHandler(event);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(sendReservationEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Reserva confirmada - BarberCloud"
    }));
  });

  it("consumer SQS acepta eventos sin registros", async () => {
    // Act
    const response = await sqsNotificationConsumerHandler({});

    // Assert
    expect(response.statusCode).toBe(200);
    expect(sendReservationEmailMock).not.toHaveBeenCalled();
  });

  it("consumer SQS acepta registro sin body", async () => {
    // Act
    const response = await sqsNotificationConsumerHandler({ Records: [{}] });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(sendReservationEmailMock).not.toHaveBeenCalled();
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

  it("consumer SQS mapea errores de parseo", async () => {
    // Arrange
    const event = { Records: [{ body: "no-json" }] };

    // Act
    const response = await sqsNotificationConsumerHandler(event);

    // Assert
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });
});

describe("nuevaReserva handler", () => {
  const nuevaReservaHandler = createNuevaReservaHandler(nuevaReservaServiceMock);

  beforeEach(() => {
    nuevaReservaServiceMock.createOnlineReservation.mockReset();
  });

  it("crea reserva exitosamente para cliente", async () => {
    nuevaReservaServiceMock.createOnlineReservation.mockResolvedValue({ reservaId: "res-1" });

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
    nuevaReservaServiceMock.createOnlineReservation.mockRejectedValue(new ServiceError("Datos invalidos"));

    const event = lambdaEvent({ role: "CLIENTE" });
    const response = await nuevaReservaHandler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Datos invalidos" });
  });

  it("devuelve 400 cuando hay conflicto de horario", async () => {
    nuevaReservaServiceMock.createOnlineReservation.mockRejectedValue({ name: "TransactionCanceledException" });

    const event = lambdaEvent({ role: "CLIENTE" });
    const response = await nuevaReservaHandler(event);

    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toEqual({ error: "Horario no disponible" });
  });

  it("devuelve 500 en error inesperado", async () => {
    nuevaReservaServiceMock.createOnlineReservation.mockRejectedValue(new Error("DB timeout"));

    const event = lambdaEvent({ role: "CLIENTE" });
    const response = await nuevaReservaHandler(event);

    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toEqual({ error: "Error interno del servidor" });
  });
});
