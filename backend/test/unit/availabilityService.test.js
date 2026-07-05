import { describe, expect, it, vi } from "vitest";
import {
  calculateAvailability,
  createAvailabilityService,
  mapAvailableBarbers,
  mapAvailableServices
} from "../../src/services/availabilityService.js";
import { createRepositoryMock, fixedClock } from "../helpers/mocks.js";

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

  it("usa agenda vacia cuando no existe entrada del barbero", () => {
    // Arrange
    const agendaByBarber = {};

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

describe("availability mapping", () => {
  it("usa servicios por defecto si no hay datos en repositorio", () => {
    // Arrange
    const items = [];

    // Act
    const services = mapAvailableServices(items);

    // Assert
    expect(services).toEqual([
      { id: "corte-clasico", nombre: "Corte clasico", precio: 30 },
      { id: "barba", nombre: "Perfilado de barba", precio: 20 },
      { id: "corte-barba", nombre: "Corte y barba", precio: 45 }
    ]);
  });

  it("filtra servicios inactivos y mapea barberos", () => {
    // Arrange
    const servicios = [
      { servicioId: "corte", nombre: "Corte", precio: 30, estado: "ACTIVO" },
      { servicioId: "tinte", nombre: "Tinte", precio: 50, estado: "INACTIVO" }
    ];
    const barberos = [{ barberoId: "barbero_1", nombre: "Carlos" }];

    // Act
    const mappedServices = mapAvailableServices(servicios);
    const mappedBarbers = mapAvailableBarbers(barberos);

    // Assert
    expect(mappedServices).toEqual([{ id: "corte", nombre: "Corte", precio: 30 }]);
    expect(mappedBarbers).toEqual([{ id: "barbero_1", nombre: "Carlos" }]);
  });
});

describe("createAvailabilityService", () => {
  it("consulta repositorio y devuelve disponibilidad completa", async () => {
    // Arrange
    const repository = createRepositoryMock({
      scanByTipo: vi.fn()
        .mockResolvedValueOnce([{ servicioId: "corte", nombre: "Corte", precio: 30, estado: "ACTIVO" }])
        .mockResolvedValueOnce([{ barberoId: "barbero_1", nombre: "Carlos" }]),
      queryByPk: vi.fn().mockResolvedValue([
        { tipo: "RESERVA", fecha: "2026-07-10", hora: "09:00", estado: "CONFIRMADA" }
      ])
    });
    const service = createAvailabilityService({ repository, clock: fixedClock("2026-07-04T10:00:00.000Z") });

    // Act
    const result = await service.getAvailability({ queryStringParameters: { fecha: "2026-07-10" } });

    // Assert
    expect(repository.scanByTipo).toHaveBeenNthCalledWith(1, "SERVICIO");
    expect(repository.scanByTipo).toHaveBeenNthCalledWith(2, "BARBERO");
    expect(repository.queryByPk).toHaveBeenCalledWith("BARBERO#barbero_1");
    expect(result).toMatchObject({
      fecha: "2026-07-10",
      servicios: [{ id: "corte", nombre: "Corte", precio: 30 }],
      barberos: [{ id: "barbero_1", nombre: "Carlos" }]
    });
    expect(result.disponibilidad.barbero_1).not.toContain("09:00");
  });

  it("usa la fecha actual cuando no llega query string", async () => {
    // Arrange
    const repository = createRepositoryMock();
    const service = createAvailabilityService({ repository, clock: fixedClock("2026-07-04T10:00:00.000Z") });

    // Act
    const result = await service.getAvailability({});

    // Assert
    expect(result.fecha).toBe("2026-07-04");
    expect(result.barberos).toEqual([{ id: "barbero_carlos", nombre: "Carlos Barbero" }]);
  });
});
