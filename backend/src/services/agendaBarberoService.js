import { ServiceError } from "./errors.js";

export const ESTADOS_VALIDOS_BARBERO = ["EN_PROCESO", "FINALIZADO", "CANCELADA"];
export const TURNOS_VALIDOS = ["ACTIVO", "DESCANSO"];

export function createAgendaBarberoService({ repository, auditLog, clock = () => new Date(), tableName = "barbercloud-local" }) {
  return {
    async updateReservationStatus(event, barberoId) {
      const reservaId = event.pathParameters?.id;
      const body = JSON.parse(event.body || "{}");
      const { estado } = body;

      if (!reservaId) {
        throw new ServiceError("reservaId es obligatorio");
      }

      if (!ESTADOS_VALIDOS_BARBERO.includes(estado)) {
        throw new ServiceError(`estado debe ser uno de: ${ESTADOS_VALIDOS_BARBERO.join(", ")}`);
      }

      const citas = await repository.queryByPk(`BARBERO#${barberoId}`);
      const cita = citas.find(item => item.tipo === "RESERVA" && item.reservaId === reservaId);

      if (!cita) {
        throw new ServiceError("Cita no encontrada para este barbero");
      }

      if (cita.estado === "CANCELADA" || cita.estado === "FINALIZADO") {
        throw new ServiceError(`No se puede modificar una cita en estado ${cita.estado}`);
      }

      const now = clock().toISOString();
      const citaActualizada = { ...cita, estado, actualizadoEn: now };

      const writes = [
        {
          Put: {
            TableName: tableName,
            Item: citaActualizada,
            ConditionExpression: "attribute_not_exists(pk) OR reservaId = :reservaId",
            ExpressionAttributeValues: { ":reservaId": reservaId }
          }
        }
      ];

      if (cita.clienteId) {
        writes.push({
          Put: {
            TableName: tableName,
            Item: { ...citaActualizada, pk: `CLIENTE#${cita.clienteId}`, sk: cita.sk },
            ConditionExpression: "attribute_not_exists(pk) OR reservaId = :reservaId",
            ExpressionAttributeValues: { ":reservaId": reservaId }
          }
        });
      }

      await repository.transactWrite(writes);
      await auditLog(event, "CITA_ACTUALIZAR_ESTADO", "OK", { reservaId, estado });

      return { message: "Estado actualizado correctamente", reservaId, estado };
    },

    async updateTurnoStatus(event, barberoId) {
      const body = JSON.parse(event.body || "{}");
      const { turnoEstado } = body;

      if (!TURNOS_VALIDOS.includes(turnoEstado)) {
        throw new ServiceError(`turnoEstado debe ser uno de: ${TURNOS_VALIDOS.join(", ")}`);
      }

      const perfil = await repository.getItem(`BARBERO#${barberoId}`, "PROFILE");

      await repository.putItem({
        ...perfil,
        pk: `BARBERO#${barberoId}`,
        sk: "PROFILE",
        tipo: "BARBERO",
        barberoId,
        turnoEstado
      });

      await auditLog(event, "BARBERO_TURNO_ACTUALIZAR", "OK", { barberoId, turnoEstado });

      return { message: "Turno actualizado correctamente", turnoEstado };
    }
  };
}
