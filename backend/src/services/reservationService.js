import { getUser } from "../lib/auth.js";
import { ServiceError } from "./errors.js";

export const PUNTOS_POR_RESERVA_ONLINE = 10;

async function otorgarPuntosLealtad(repository, { clienteId, nombre, email }) {
  const perfil = await repository.getItem(`CLIENTE#${clienteId}`, "PROFILE");

  await repository.putItem({
    ...perfil,
    pk: `CLIENTE#${clienteId}`,
    sk: "PROFILE",
    tipo: "CLIENTE",
    clienteId,
    nombre: perfil?.nombre || nombre,
    email: perfil?.email || email,
    puntos: (perfil?.puntos || 0) + PUNTOS_POR_RESERVA_ONLINE
  });
}

export function validateOnlineReservationInput(body) {
  const { servicioId, barberoId, fecha, hora } = body;

  if (!servicioId || !barberoId || !fecha || !hora) {
    throw new ServiceError("servicioId, barberoId, fecha y hora son obligatorios");
  }

  return { servicioId, barberoId, fecha, hora };
}

export function assertReservaNoEsPasada(fecha, hora, ahora) {
  const fechaHora = new Date(`${fecha}T${hora}:00Z`);

  if (fechaHora.getTime() <= ahora.getTime()) {
    throw new ServiceError("No se puede reservar en una fecha y hora que ya paso");
  }
}

export function validatePresentialReservationInput(body) {
  const { clienteCorreo, servicioId, barberoId, fecha, hora } = body;

  if (!clienteCorreo || !servicioId || !barberoId || !fecha || !hora) {
    throw new ServiceError("clienteCorreo, servicioId, barberoId, fecha y hora son obligatorios");
  }

  return { clienteCorreo, servicioId, barberoId, fecha, hora };
}

function buildReservationWrites({ reservaCliente, barberoId, fecha, hora, tableName }) {
  const reservaId = reservaCliente.reservaId;

  return [
    {
      Put: {
        TableName: tableName,
        Item: reservaCliente,
        // Solo permite escribir si no existe o si esta cancelada Y es la misma reserva (rebooking)
        ConditionExpression: "attribute_not_exists(pk) OR (estado = :cancelada AND reservaId = :reservaId)",
        ExpressionAttributeValues: {
          ":cancelada": "CANCELADA",
          ":reservaId": reservaId
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
        // Previene double booking: solo permite si el slot no existe, esta cancelado, o es la misma reserva
        ConditionExpression: "attribute_not_exists(pk) OR (estado = :cancelada AND reservaId = :reservaId)",
        ExpressionAttributeValues: {
          ":cancelada": "CANCELADA",
          ":reservaId": reservaId
        }
      }
    }
  ];
}

function getClientIdentity(user) {
  if (!user.sub) {
    throw new ServiceError("Identidad de cliente no valida", 401);
  }

  const clienteId = user.sub;
  const clienteCorreo = user.email || "";
  const clienteNombre = user.name;

  return { clienteId, clienteCorreo, clienteNombre };
}

function findReservationById(reservas, reservaId) {
  const matches = reservas.filter(item =>
    item.tipo === "RESERVA" &&
    item.reservaId === reservaId
  );

  return matches.find(item => item.estado !== "CANCELADA") || matches[0];
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
      const { clienteId, clienteCorreo, clienteNombre } = getClientIdentity(user);
      const ahora = clock();
      assertReservaNoEsPasada(fecha, hora, ahora);
      const reservaId = `res_${idGenerator()}`;
      const now = ahora.toISOString();
      const servicio = await repository.getItem(`SERVICIO#${servicioId}`, "PROFILE");

      const reservaCliente = {
        pk: `CLIENTE#${clienteId}`,
        sk: `RESERVA#${fecha}#${hora}`,
        tipo: "RESERVA",
        reservaId,
        clienteId,
        clienteNombre,
        clienteCorreo,
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

      try {
        await otorgarPuntosLealtad(repository, { clienteId, nombre: clienteNombre, email: clienteCorreo });
      } catch {
        // Los puntos de lealtad no deben bloquear la confirmacion de la reserva
      }

      return {
        message: "Reserva creada correctamente",
        reservaId
      };
    },

    async rescheduleReservation(event) {
      const user = getUser(event);
      const { clienteId } = getClientIdentity(user);
      const reservaId = event.pathParameters?.id;
      const body = JSON.parse(event.body || "{}");
      const { fecha: nuevaFecha, hora: nuevaHora } = body;

      if (!reservaId) {
        throw new ServiceError("reservaId es obligatorio");
      }

      if (!nuevaFecha || !nuevaHora) {
        throw new ServiceError("fecha y hora son obligatorios");
      }

      const ahora = clock();
      assertReservaNoEsPasada(nuevaFecha, nuevaHora, ahora);

      const reservas = await repository.queryByPk(`CLIENTE#${clienteId}`);
      const reserva = findReservationById(reservas, reservaId);

      if (!reserva) {
        throw new ServiceError("Reserva no encontrada para este cliente");
      }

      if (reserva.estado === "CANCELADA") {
        throw new ServiceError("La reserva ya se encuentra cancelada");
      }

      if (reserva.fecha === nuevaFecha && reserva.hora === nuevaHora) {
        throw new ServiceError("La nueva fecha y hora deben ser distintas a la actual");
      }

      const now = ahora.toISOString();

      const reservaAnteriorCancelada = {
        ...reserva,
        estado: "CANCELADA",
        canceladoEn: now
      };

      const reservaReprogramada = {
        ...reserva,
        sk: `RESERVA#${nuevaFecha}#${nuevaHora}`,
        fecha: nuevaFecha,
        hora: nuevaHora,
        estado: "CONFIRMADA",
        reprogramadoEn: now
      };

      const writes = [
        {
          Put: {
            TableName: tableName,
            Item: reservaAnteriorCancelada,
            ConditionExpression: "attribute_not_exists(pk) OR estado <> :cancelada",
            ExpressionAttributeValues: { ":cancelada": "CANCELADA" }
          }
        },
        {
          Put: {
            TableName: tableName,
            Item: reservaReprogramada,
            ConditionExpression: "attribute_not_exists(pk) OR (estado = :cancelada AND reservaId = :reservaId)",
            ExpressionAttributeValues: { ":cancelada": "CANCELADA", ":reservaId": reservaId }
          }
        }
      ];

      if (reserva.barberoId) {
        writes.push(
          {
            Put: {
              TableName: tableName,
              Item: { ...reservaAnteriorCancelada, pk: `BARBERO#${reserva.barberoId}`, sk: `RESERVA#${reserva.fecha}#${reserva.hora}` },
              ConditionExpression: "attribute_not_exists(pk) OR (estado <> :cancelada AND reservaId = :reservaId)",
              ExpressionAttributeValues: { ":cancelada": "CANCELADA", ":reservaId": reservaId }
            }
          },
          {
            Put: {
              TableName: tableName,
              Item: { ...reservaReprogramada, pk: `BARBERO#${reserva.barberoId}`, sk: `RESERVA#${nuevaFecha}#${nuevaHora}` },
              ConditionExpression: "attribute_not_exists(pk) OR (estado = :cancelada AND reservaId = :reservaId)",
              ExpressionAttributeValues: { ":cancelada": "CANCELADA", ":reservaId": reservaId }
            }
          }
        );
      }

      await repository.transactWrite(writes);
      await auditLog(event, "RESERVA_REPROGRAMAR", "OK", { reservaId, nuevaFecha, nuevaHora });
      await publishReservationEvent("RESERVA_REPROGRAMADA", reservaReprogramada);

      return {
        message: "Reserva reprogramada correctamente",
        reservaId
      };
    },

    async cancelReservation(event) {
      const user = getUser(event);
      const { clienteId } = getClientIdentity(user);
      const reservaId = event.pathParameters?.id;

      if (!reservaId) {
        throw new ServiceError("reservaId es obligatorio");
      }

      const reservas = await repository.queryByPk(`CLIENTE#${clienteId}`);
      const reserva = findReservationById(reservas, reservaId);

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
          Item: reservaCancelada,
          // Prevenir sobreescritura de una reserva ya cancelada por otro proceso
          ConditionExpression: "attribute_not_exists(pk) OR estado <> :cancelada",
          ExpressionAttributeValues: {
            ":cancelada": "CANCELADA"
          }
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
            },
            ConditionExpression: "attribute_not_exists(pk) OR (estado <> :cancelada AND reservaId = :reservaId)",
            ExpressionAttributeValues: {
              ":cancelada": "CANCELADA",
              ":reservaId": reservaId
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

      // Verificacion anticipada para mejor UX (el transactWrite garantiza atomicidad real)
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

      // El transactWrite garantiza atomicidad: si hay conflicto, toda la operacion falla
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
