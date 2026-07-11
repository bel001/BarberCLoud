import { v4 as uuid } from "uuid";
import { requireRole } from "../lib/auth.js";
import * as repository from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { publishReservationEvent } from "../lib/notifications.js";
import { created, ok, badRequest, serverError } from "../lib/response.js";
import { ServiceError, isConflictError } from "../services/errors.js";
import { createReservationService } from "../services/reservationService.js";

async function registrarClienteRapido(event, repository, auditLog) {
  const body = JSON.parse(event.body || "{}");
  const { nombre, email, telefono } = body;

  if (!nombre || !email) {
    throw new ServiceError("nombre y email son obligatorios");
  }

  const existente = await repository.findClienteByEmail(email);

  if (existente) {
    throw new ServiceError("Ya existe un cliente registrado con ese correo");
  }

  const clienteId = `cliente_${uuid()}`;
  const now = new Date().toISOString();

  await repository.putItem({
    pk: `CLIENTE#${clienteId}`,
    sk: "PROFILE",
    tipo: "CLIENTE",
    clienteId,
    nombre,
    email,
    telefono: telefono || null,
    gsi1pk: `CLIENTE_EMAIL#${email}`,
    gsi1sk: `CLIENTE#${clienteId}`,
    creadoEn: now
  });

  await auditLog(event, "CLIENTE_REGISTRAR_RAPIDO", "OK", { clienteId, email });

  return { message: "Cliente registrado correctamente", clienteId };
}

const tableName = process.env.TABLE_NAME || "barbercloud-local";

const reservationService = createReservationService({
  repository,
  auditLog: audit,
  publishReservationEvent,
  idGenerator: uuid,
  tableName
});

export function createGestionClientesHandler({ service, repository, auditLog = audit }) {
  return async function gestionClientesHandler(event) {
    try {
      requireRole(event, ["SECRETARIA", "ADMIN"]);

      const method = event.requestContext.http.method;
      const path = event.rawPath;
      const clienteId = event.pathParameters?.id;

      if (method === "GET" && clienteId && path.includes("/historial")) {
        const items = await repository.queryByPk(`CLIENTE#${clienteId}`);
        return ok({ reservas: items.filter(item => item.tipo === "RESERVA") });
      }

      if (method === "GET" && path.includes("/clientes")) {
        return ok({ clientes: await repository.scanByTipo("CLIENTE") });
      }

      if (method === "POST" && path.includes("/reservas-presenciales")) {
        return created(await service.createPresentialReservation(event));
      }

      if (method === "POST" && path.includes("/clientes")) {
        return created(await registrarClienteRapido(event, repository, auditLog));
      }

      return badRequest("Operacion no soportada");
    } catch (error) {
      if (error instanceof ServiceError) {
        return badRequest(error.message);
      }

      if (isConflictError(error)) {
        return badRequest("Horario no disponible");
      }

      return serverError(error);
    }
  };
}

export const handler = createGestionClientesHandler({ service: reservationService, repository });
