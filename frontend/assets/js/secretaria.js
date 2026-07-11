const sessionSecretaria = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = sessionSecretaria.name || sessionSecretaria.email || "Secretaria";
  document.getElementById("secretariaNombre").textContent = nombre;
  document.getElementById("secretariaAvatar").textContent = nombre.charAt(0).toUpperCase();
}

function esFutura(cita) {
  return new Date(`${cita.fecha}T${cita.hora}:00Z`).getTime() > Date.now();
}

function esHoy(cita) {
  return cita.fecha === new Date().toISOString().slice(0, 10);
}

async function cargarResumen() {
  try {
    const [agendaData, posData] = await Promise.all([
      API.get("/secretaria/agenda", sessionSecretaria.token),
      API.get("/secretaria/pos", sessionSecretaria.token)
    ]);

    const citas = agendaData.citas || [];
    const citasHoy = citas.filter(c => esHoy(c) && c.estado !== "CANCELADA");
    document.getElementById("statCitasHoy").textContent = citasHoy.length;

    document.getElementById("statCaja").textContent = posData.sesionCaja ? "Abierta" : "Cerrada";
    document.getElementById("statTotalCaja").textContent = `S/ ${posData.total || 0}`;

    const proximas = citas
      .filter(c => (c.estado === "CONFIRMADA" || c.estado === "EN_PROCESO") && esFutura(c))
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
      .slice(0, 6);

    const container = document.getElementById("reservasEnVivo");

    container.innerHTML = proximas.length
      ? proximas.map(cita => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(cita.clienteNombre)} <span class="badge badge-info">${escapeHtml(cita.barberoId)}</span></div>
            <div class="list-item-subtitle">📅 ${escapeHtml(cita.fecha)} • ⏰ ${escapeHtml(cita.hora)} • ${escapeHtml(cita.servicioNombre || cita.servicioId)}</div>
          </div>
        </div>
      `).join("")
      : `<p class="text-muted text-sm">No hay próximas reservas.</p>`;
  } catch (error) {
    Toast.show("Error al cargar el resumen: " + error.message, "error");
  }
}

async function registrarCitaPresencial(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const payload = {
      clienteCorreo: document.getElementById("clienteCorreo").value,
      servicioId: document.getElementById("servicioId").value,
      barberoId: document.getElementById("barberoId").value,
      fecha: document.getElementById("fecha").value,
      hora: document.getElementById("hora").value
    };

    const response = await API.post("/secretaria/reservas-presenciales", payload, sessionSecretaria.token);

    if (response.reservaId) {
      Toast.show("Cita presencial registrada: " + response.reservaId, "success");
      document.getElementById("formPresencial").reset();
      await cargarResumen();
    } else {
      Toast.show(response.error || "Error al registrar", "error");
    }
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  document.getElementById("fecha").valueAsDate = new Date();
  document.getElementById("formPresencial").addEventListener("submit", registrarCitaPresencial);
  cargarResumen();
});
