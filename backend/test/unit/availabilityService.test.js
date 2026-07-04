import { describe, expect, it } from "vitest";
import { calculateAvailability } from "../../src/services/availabilityService.js";

const barbers = [{ id: "barbero_carlos", nombre: "Carlos Barbero" }];
const schedule = ["09:00", "10:00", "11:00"];

describe("calculateAvailability", () => {
  it("devuelve horarios libres cuando no hay reservas", () => {
    // Arrange
    const agendaByBarber = { barbero_carlos: [] };

    // Act
    const result = calculateAvailability({
      barbers,
      agendaByBarber,
      fecha: "2026-07-10",
      schedule
    });

    // Assert
    expect(result.barbero_carlos).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("excluye horarios ocupados", () => {
    // Arrange
    const agendaByBarber = {
      barbero_carlos: [
        { tipo: "RESERVA", fecha: "2026-07-10", hora: "10:00", estado: "CONFIRMADA" }
      ]
    };

    // Act
    const result = calculateAvailability({
      barbers,
      agendaByBarber,
      fecha: "2026-07-10",
      schedule
    });

    // Assert
    expect(result.barbero_carlos).toEqual(["09:00", "11:00"]);
  });

  it("no bloquea horarios de reservas canceladas", () => {
    // Arrange
    const agendaByBarber = {
      barbero_carlos: [
        { tipo: "RESERVA", fecha: "2026-07-10", hora: "10:00", estado: "CANCELADA" }
      ]
    };

    // Act
    const result = calculateAvailability({
      barbers,
      agendaByBarber,
      fecha: "2026-07-10",
      schedule
    });

    // Assert
    expect(result.barbero_carlos).toEqual(["09:00", "10:00", "11:00"]);
  });
});
