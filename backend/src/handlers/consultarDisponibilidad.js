import { queryByPk, scanByTipo } from "../lib/dynamodb.js";
import { ok, serverError } from "../lib/response.js";

const servicios = [
  { id: "corte-clasico", nombre: "Corte clasico", precio: 30 },
  { id: "barba", nombre: "Perfilado de barba", precio: 20 },
  { id: "corte-barba", nombre: "Corte y barba", precio: 45 }
];

const barberos = [
  { id: "barbero_carlos", nombre: "Carlos Barbero" }
];

const horarios = [
  "09:00",
  "10:00",
  "11:00",
  "15:00",
  "16:00",
  "17:00"
];

export async function handler(event = {}) {
  try {
    const fecha = event.queryStringParameters?.fecha || new Date().toISOString().slice(0, 10);
    const serviciosDb = await scanByTipo("SERVICIO");
    const barberosDb = await scanByTipo("BARBERO");

    const serviciosDisponibles = serviciosDb.length
      ? serviciosDb.filter(item => item.estado !== "INACTIVO").map(item => ({
        id: item.servicioId,
        nombre: item.nombre,
        precio: item.precio
      }))
      : servicios;

    const barberosDisponibles = barberosDb.length
      ? barberosDb.map(item => ({
        id: item.barberoId,
        nombre: item.nombre
      }))
      : barberos;

    const disponibilidad = {};

    for (const barbero of barberosDisponibles) {
      const agenda = await queryByPk(`BARBERO#${barbero.id}`);
      const ocupados = new Set(
        agenda
          .filter(item => item.tipo === "RESERVA" && item.fecha === fecha && item.estado !== "CANCELADA")
          .map(item => item.hora)
      );

      disponibilidad[barbero.id] = horarios.filter(hora => !ocupados.has(hora));
    }

    return ok({
      fecha,
      servicios: serviciosDisponibles,
      barberos: barberosDisponibles,
      horarios,
      disponibilidad
    });
  } catch (error) {
    return serverError(error);
  }
}
