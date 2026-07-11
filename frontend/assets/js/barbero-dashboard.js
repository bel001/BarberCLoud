const sessionBarberoDash = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = sessionBarberoDash.name || sessionBarberoDash.email || "Barbero";
  document.getElementById("barberoNombre").textContent = nombre;
  document.getElementById("barberoAvatar").textContent = nombre.charAt(0).toUpperCase();
}

function esFutura(cita) {
  return new Date(`${cita.fecha}T${cita.hora}:00Z`).getTime() > Date.now();
}

function actualizarBotonTurno(turnoEstado) {
  const btn = document.getElementById("btnToggleTurno");
  const activo = turnoEstado === "ACTIVO";

  btn.textContent = activo ? "En turno · Pasar a descanso" : "En descanso · Volver a turno";
  btn.dataset.turnoActual = turnoEstado;
  document.getElementById("barberoTurnoLabel").textContent = activo ? "Estación activa" : "En descanso";
}

async function cambiarTurno() {
  const btn = document.getElementById("btnToggleTurno");
  const nuevoTurno = btn.dataset.turnoActual === "ACTIVO" ? "DESCANSO" : "ACTIVO";

  try {
    const response = await API.put("/barbero/turno", { turnoEstado: nuevoTurno }, sessionBarberoDash.token);
    actualizarBotonTurno(response.turnoEstado);
    Toast.show(response.message || "Turno actualizado", "success");
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function cargarDashboard() {
  try {
    const data = await API.get("/barbero/agenda", sessionBarberoDash.token);
    const citas = data.citas || [];

    actualizarBotonTurno(data.turnoEstado || "ACTIVO");

    const finalizadas = citas.filter(c => c.estado === "FINALIZADO");
    const ganancias = finalizadas.reduce((sum, c) => sum + Number(c.precio || 0), 0);
    document.getElementById("statGanancias").textContent = `S/ ${ganancias}`;

    const conteoServicios = {};
    citas.filter(c => c.estado !== "CANCELADA").forEach(c => {
      const nombre = c.servicioNombre || c.servicioId;
      if (!nombre) return;
      conteoServicios[nombre] = (conteoServicios[nombre] || 0) + 1;
    });

    const servicioPopular = Object.entries(conteoServicios).sort((a, b) => b[1] - a[1])[0];
    document.getElementById("statServicioPopular").textContent = servicioPopular
      ? `${servicioPopular[0]} (${servicioPopular[1]})`
      : "Sin datos";

    const proximas = citas
      .filter(c => (c.estado === "CONFIRMADA" || c.estado === "EN_PROCESO") && esFutura(c))
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
      .slice(0, 5);

    const container = document.getElementById("proximasCitas");

    container.innerHTML = proximas.length
      ? proximas.map(cita => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(cita.clienteNombre)}</div>
            <div class="list-item-subtitle">📅 ${escapeHtml(cita.fecha)} • ⏰ ${escapeHtml(cita.hora)} • ${escapeHtml(cita.servicioNombre || cita.servicioId)}</div>
          </div>
        </div>
      `).join("")
      : `<p class="text-muted text-sm">No tienes próximas citas.</p>`;
  } catch (error) {
    Toast.show("Error al cargar el dashboard: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarDashboard();
  document.getElementById("btnToggleTurno").addEventListener("click", cambiarTurno);
});
