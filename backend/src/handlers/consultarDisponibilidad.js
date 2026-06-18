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

export async function handler() {
  try {
    return ok({ servicios, barberos, horarios });
  } catch (error) {
    return serverError(error);
  }
}
