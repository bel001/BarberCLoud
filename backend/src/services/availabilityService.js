const defaultServices = [
  { id: "corte-clasico", nombre: "Corte clasico", precio: 30, duracionMinutos: 30 },
  { id: "barba", nombre: "Perfilado de barba", precio: 20, duracionMinutos: 20 },
  { id: "corte-barba", nombre: "Corte y barba", precio: 45, duracionMinutos: 45 }
];

const defaultBarbers = [
  { id: "barbero_carlos", nombre: "Carlos Barbero" }
];

export const defaultSchedule = [
  "09:00",
  "10:00",
  "11:00",
  "15:00",
  "16:00",
  "17:00"
];

export function mapAvailableServices(items) {
  return items.length
    ? items.filter(item => item.estado !== "INACTIVO").map(item => ({
      id: item.servicioId,
      nombre: item.nombre,
      precio: item.precio,
      duracionMinutos: item.duracionMinutos || 45
    }))
    : defaultServices;
}

export function mapAvailableBarbers(items) {
  return items.length
    ? items.map(item => ({
      id: item.barberoId,
      nombre: item.nombre
    }))
    : defaultBarbers;
}

export function calculateAvailability({ barbers, agendaByBarber, fecha, schedule = defaultSchedule }) {
  const disponibilidad = {};

  for (const barbero of barbers) {
    const agenda = agendaByBarber[barbero.id] || [];
    const ocupados = new Set(
      agenda
        .filter(item => item.tipo === "RESERVA" && item.fecha === fecha && item.estado !== "CANCELADA")
        .map(item => item.hora)
    );

    disponibilidad[barbero.id] = schedule.filter(hora => !ocupados.has(hora));
  }

  return disponibilidad;
}

export function createAvailabilityService({ repository, clock = () => new Date() }) {
  return {
    async getAvailability(event = {}) {
      const fecha = event.queryStringParameters?.fecha || clock().toISOString().slice(0, 10);
      const serviciosDb = await repository.scanByTipo("SERVICIO");
      const barberosDb = await repository.scanByTipo("BARBERO");
      const servicios = mapAvailableServices(serviciosDb);
      const barberos = mapAvailableBarbers(barberosDb);
      const agendaByBarber = {};

      for (const barbero of barberos) {
        agendaByBarber[barbero.id] = await repository.queryByPk(`BARBERO#${barbero.id}`);
      }

      return {
        fecha,
        servicios,
        barberos,
        horarios: defaultSchedule,
        disponibilidad: calculateAvailability({ barbers: barberos, agendaByBarber, fecha })
      };
    }
  };
}
