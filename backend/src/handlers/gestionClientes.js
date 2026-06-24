import { requireRole, getUser } from "../lib/auth.js";
import { queryByPk, findClienteByEmail, scanByTipo, transactWrite } from "../lib/dynamodb.js";
import { audit } from "../lib/audit.js";
import { publishReservationEvent } from "../lib/notifications.js";
import { created, ok, badRequest, serverError } from "../lib/response.js";
import { v4 as uuid } from "uuid";

const tableName = process.env.TABLE_NAME || "barbercloud-local";

export async function handler(event) {
  try {
    requireRole(event, ["SECRETARIA", "ADMIN"]);

    const method = event.requestContext.http.method;
    const path = event.rawPath;

    if (method === "GET" && path.includes("/clientes")) {
      return ok({ clientes: await scanByTipo("CLIENTE") });
    }

    if (method === "POST" && path.includes("/reservas-presenciales")) {
      return await registrarReservaPresencial(event);
    }

    return badRequest("Operacion no soportada");
  } catch (error) {
    return serverError(error);
  }
}

async function registrarReservaPresencial(event) {
  const user = getUser(event);
  const body = JSON.parse(event.body || "{}");

  const { clienteCorreo, servicioId, barberoId, fecha, hora } = body;

  if (!clienteCorreo || !servicioId || !barberoId || !fecha || !hora) {
    return badRequest("clienteCorreo, servicioId, barberoId, fecha y hora son obligatorios");
  }

  const cliente = await findClienteByEmail(clienteCorreo);

  if (!cliente) {
    return badRequest("El cliente no esta registrado. Debe crear una cuenta antes de agendar una cita presencial.");
  }

  const agenda = await queryByPk(`BARBERO#${barberoId}`);
  const conflicto = agenda.find(item =>
    item.fecha === fecha &&
    item.hora === hora &&
    item.estado !== "CANCELADA"
  );

  if (conflicto) {
    return badRequest("Horario no disponible");
  }

  const reservaId = `res_${uuid()}`;
  const now = new Date().toISOString();

  const reservaCliente = {
    pk: `CLIENTE#${cliente.clienteId}`,
    sk: `RESERVA#${fecha}#${hora}`,
    tipo: "RESERVA",
    reservaId,
    clienteId: cliente.clienteId,
    clienteNombre: cliente.nombre,
    clienteCorreo: cliente.email,
    servicioId,
    barberoId,
    fecha,
    hora,
    origen: "PRESENCIAL",
    estado: "CONFIRMADA",
    creadoPor: user.email,
    creadoRol: "SECRETARIA",
    creadoEn: now
  };

  const reservaAgenda = {
    ...reservaCliente,
    pk: `BARBERO#${barberoId}`,
    sk: `RESERVA#${fecha}#${hora}`
  };

  await transactWrite([
    {
      Put: {
        TableName: tableName,
        Item: reservaCliente,
        ConditionExpression: "attribute_not_exists(pk) OR estado = :cancelada",
        ExpressionAttributeValues: {
          ":cancelada": "CANCELADA"
        }
      }
    },
    {
      Put: {
        TableName: tableName,
        Item: reservaAgenda,
        ConditionExpression: "attribute_not_exists(pk) OR estado = :cancelada",
        ExpressionAttributeValues: {
          ":cancelada": "CANCELADA"
        }
      }
    }
  ]);

  await audit(event, "RESERVA_PRESENCIAL_CREAR", "OK", { reservaId, clienteCorreo, barberoId, fecha, hora });
  await publishReservationEvent("RESERVA_CREADA", reservaCliente);

  return created({
    message: "Cita presencial registrada para cliente existente",
    reservaId,
    clienteId: cliente.clienteId
  });
}
