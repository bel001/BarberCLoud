import { getUser } from "../lib/auth.js";
import { ServiceError } from "./errors.js";

export function validateOnlineReservationInput(body) {
  const { servicioId, barberoId, fecha, hora } = body;

  if (!servicioId || !barberoId || !fecha || !hora) {
    throw new ServiceError("servicioId, barberoId, fecha y hora son obligatorios");
  }

  return { servicioId, barberoId, fecha, hora };
}

export function validatePresentialReservationInput(body) {
  const { clienteCorreo, servicioId, barberoId, fecha, hora } = body;

  if (!clienteCorreo || !servicioId || !barberoId || !fecha || !hora) {
    throw new ServiceError("clienteCorreo, servicioId, barberoId, fecha y hora son obligatorios");
  }

  return { clienteCorreo, servicioId, barberoId, fecha, hora };
}

function buildReservationWrites({ reservaCliente, barberoId, fecha, hora, tableName }) {
  return [
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
        Item: {
          ...reservaCliente,
          pk: `BARBERO#${barberoId}`,
          sk: `RESERVA#${fecha}#${hora}`
        },
        ConditionExpression: "attribute_not_exists(pk) OR estado = :cancelada",
        ExpressionAttributeValues: {
          ":cancelada": "CANCELADA"
        }
      }
    }
  ];
}

export function createReservationService({
  repository,
  auditLog,
  publishReservationEvent,
  idGenerator,
  clock = () => new Date(),
  tableName = "barbercloud-local"
}) {
  return {
    async createOnlineReservation(event) {
      const user = getUser(event);
      const body = JSON.parse(event.body || "{}");
      const { servicioId, barberoId, fecha, hora } = validateOnlineReservationInput(body);
      const reservaId = `res_${idGenerator()}`;
      const now = clock().toISOString();
      const servicio = await repository.getItem(`SERVICIO#${servicioId}`, "PROFILE");

      const reservaCliente = {
        pk: `CLIENTE#${user.sub}`,
        sk: `RESERVA#${fecha}#${hora}`,
        tipo: "RESERVA",
        reservaId,
        clienteId: user.sub,
        clienteNombre: user.name,
        clienteCorreo: user.email,
        servicioId,
        servicioNombre: servicio?.nombre || servicioId,
        precio: Number(servicio?.precio || 0),
        barberoId,
        fecha,
        hora,
        origen: "ONLINE",
        estado: "CONFIRMADA",
        creadoPor: "CLIENTE",
        creadoEn: now
      };

      await repository.transactWrite(buildReservationWrites({ reservaCliente, barberoId, fecha, hora, tableName }));
      await auditLog(event, "RESERVA_CREAR", "OK", { reservaId, barberoId, fecha, hora });
      await publishReservationEvent("RESERVA_CREADA", reservaCliente);

      return {
        message: "Reserva creada correctamente",
        reservaId
      };
    },

    async cancelReservation(event) {
      const user = getUser(event);
      const reservaId = event.pathParameters?.id;

      if (!reservaId) {
        throw new ServiceError("reservaId es obligatorio");
      }

      const reservas = await repository.queryByPk(`CLIENTE#${user.sub}`);
      const reserva = reservas.find(item =>
        item.tipo === "RESERVA" &&
        item.reservaId === reservaId
      );

      if (!reserva) {
        throw new ServiceError("Reserva no encontrada para este cliente");
      }

      if (reserva.estado === "CANCELADA") {
        throw new ServiceError("La reserva ya se encuentra cancelada");
      }

      const reservaCancelada = {
        ...reserva,
        estado: "CANCELADA",
        canceladoEn: clock().toISOString()
      };

      const writes = [{
        Put: {
          TableName: tableName,
          Item: reservaCancelada
        }
      }];

      if (reserva.barberoId) {
        writes.push({
          Put: {
            TableName: tableName,
            Item: {
              ...reservaCancelada,
              pk: `BARBERO#${reserva.barberoId}`,
              sk: `RESERVA#${reserva.fecha}#${reserva.hora}`
            }
          }
        });
      }

      await repository.transactWrite(writes);
      await auditLog(event, "RESERVA_CANCELAR", "OK", { reservaId });
      await publishReservationEvent("RESERVA_CANCELADA", reservaCancelada);

      return {
        message: "Reserva cancelada correctamente",
        reservaId
      };
    },

    async createPresentialReservation(event) {
      const user = getUser(event);
      const body = JSON.parse(event.body || "{}");
      const { clienteCorreo, servicioId, barberoId, fecha, hora } = validatePresentialReservationInput(body);
      const cliente = await repository.findClienteByEmail(clienteCorreo);

      if (!cliente) {
        throw new ServiceError("El cliente no esta registrado. Debe crear una cuenta antes de agendar una cita presencial.");
      }

      const agenda = await repository.queryByPk(`BARBERO#${barberoId}`);
      const conflicto = agenda.some(item =>
        item.fecha === fecha &&
        item.hora === hora &&
        item.estado !== "CANCELADA"
      );

      if (conflicto) {
        throw new ServiceError("Horario no disponible");
      }

      const reservaId = `res_${idGenerator()}`;
      const now = clock().toISOString();
      const servicio = await repository.getItem(`SERVICIO#${servicioId}`, "PROFILE");

      const reservaCliente = {
        pk: `CLIENTE#${cliente.clienteId}`,
        sk: `RESERVA#${fecha}#${hora}`,
        tipo: "RESERVA",
        reservaId,
        clienteId: cliente.clienteId,
        clienteNombre: cliente.nombre,
        clienteCorreo: cliente.email,
        servicioId,
        servicioNombre: servicio?.nombre || servicioId,
        precio: Number(servicio?.precio || 0),
        barberoId,
        fecha,
        hora,
        origen: "PRESENCIAL",
        estado: "CONFIRMADA",
        creadoPor: user.email,
        creadoRol: "SECRETARIA",
        creadoEn: now
      };

      await repository.transactWrite(buildReservationWrites({ reservaCliente, barberoId, fecha, hora, tableName }));
      await auditLog(event, "RESERVA_PRESENCIAL_CREAR", "OK", { reservaId, clienteCorreo, barberoId, fecha, hora });
      await publishReservationEvent("RESERVA_CREADA", reservaCliente);

      return {
        message: "Cita presencial registrada para cliente existente",
        reservaId,
        clienteId: cliente.clienteId
      };
    }
  };
}
