const sessionCitas = AUTH.requireSession();

let todasLasReservas = [];

function mostrarIdentidad() {
  const nombre = sessionCitas.name || sessionCitas.email || "Cliente";
  document.getElementById("clienteNombre").textContent = nombre;
  document.getElementById("clienteAvatar").textContent = nombre.charAt(0).toUpperCase();
}
let filtroActivo = "todas";

function getEstadoBadge(estado) {
  const badges = {
    'CONFIRMADA': 'success',
    'CANCELADA': 'danger',
    'PENDIENTE': 'warning',
    'COMPLETADA': 'info'
  };
  return badges[estado] || 'info';
}

function esFutura(reserva) {
  return new Date(`${reserva.fecha}T${reserva.hora}:00Z`).getTime() > Date.now();
}

function filtrarReservas(reservas) {
  if (filtroActivo === "activas") return reservas.filter(r => r.estado === "CONFIRMADA" && esFutura(r));
  if (filtroActivo === "pasadas") return reservas.filter(r => r.estado !== "CANCELADA" && !esFutura(r));
  if (filtroActivo === "canceladas") return reservas.filter(r => r.estado === "CANCELADA");
  return reservas;
}

function renderLista() {
  const container = document.getElementById("listaCitas");
  const reservas = [...filtrarReservas(todasLasReservas)].sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));

  if (reservas.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">No hay citas en esta categoría.</p>`;
    return;
  }

  container.innerHTML = reservas.map(item => {
    const puedeGestionar = item.estado === "CONFIRMADA" && esFutura(item);

    return `
      <div class="list-item stacked-list-item">
        <div class="appointment-summary">
          <div class="list-item-info">
            <div class="list-item-title">
              ${escapeHtml(item.servicioNombre || item.servicioId)}
              <span class="badge badge-${getEstadoBadge(item.estado)}">${escapeHtml(item.estado)}</span>
            </div>
            <div class="list-item-subtitle">
              📅 ${escapeHtml(item.fecha)} • ⏰ ${escapeHtml(formatHora12h(item.hora))}
            </div>
          </div>
          ${puedeGestionar ? `
            <div class="list-item-actions">
              <button class="btn btn-secondary btn-sm" type="button" data-cita-action="reprogramar" data-reserva-id="${escapeHtml(item.reservaId)}">Reprogramar</button>
              <button class="btn btn-secondary btn-sm" type="button" data-cita-action="cancelar" data-reserva-id="${escapeHtml(item.reservaId)}">Cancelar</button>
            </div>
          ` : ''}
        </div>
        ${puedeGestionar ? `
          <div class="reprogramar-panel hidden" id="panel-${escapeHtml(item.reservaId)}">
            <div class="form-group">
              <label class="form-label">Nueva fecha</label>
              <input type="date" class="form-input" id="fecha-${escapeHtml(item.reservaId)}" min="${new Date().toISOString().slice(0, 10)}">
            </div>
            <div class="form-group">
              <label class="form-label">Nueva hora</label>
              <select class="form-input" id="hora-${escapeHtml(item.reservaId)}"></select>
            </div>
            <button class="btn btn-primary btn-sm" type="button" data-cita-action="guardar" data-reserva-id="${escapeHtml(item.reservaId)}">Guardar</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

function esHoraPasada(fecha, hora) {
  return new Date(`${fecha}T${hora}:00Z`).getTime() <= Date.now();
}

async function toggleReprogramar(reservaId) {
  const panel = document.getElementById(`panel-${reservaId}`);
  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    const fechaInput = document.getElementById(`fecha-${reservaId}`);
    fechaInput.valueAsDate = new Date();
    await cargarHorasDisponibles(reservaId);
    fechaInput.addEventListener("change", () => cargarHorasDisponibles(reservaId));
  }
}

async function cargarHorasDisponibles(reservaId) {
  const reserva = todasLasReservas.find(r => r.reservaId === reservaId);
  const fecha = document.getElementById(`fecha-${reservaId}`).value;
  const horaSelect = document.getElementById(`hora-${reservaId}`);

  try {
    const data = await API.get(`/disponibilidad?fecha=${encodeURIComponent(fecha)}`);
    const horarios = (data.disponibilidad?.[reserva.barberoId] || []).filter(hora => !esHoraPasada(fecha, hora));

    horaSelect.innerHTML = horarios.length
      ? horarios.map(hora => `<option value="${escapeHtml(hora)}">${escapeHtml(formatHora12h(hora))}</option>`).join("")
      : `<option value="">Sin horarios disponibles</option>`;
  } catch (error) {
    Toast.show("Error al cargar horarios: " + error.message, "error");
  }
}

async function confirmarReprogramar(reservaId) {
  const fecha = document.getElementById(`fecha-${reservaId}`).value;
  const hora = document.getElementById(`hora-${reservaId}`).value;

  if (!fecha || !hora) {
    Toast.show("Elige una nueva fecha y hora", "warning");
    return;
  }

  try {
    const response = await API.post(`/reservas/${reservaId}/reprogramar`, { fecha, hora }, sessionCitas.token);
    Toast.show(response.message || "Reserva reprogramada", "success");
    await cargarCitas();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function cancelarReserva(reservaId) {
  if (!confirm("¿Cancelar esta reserva?")) return;

  try {
    const response = await API.post(`/reservas/${reservaId}/cancelar`, {}, sessionCitas.token);
    Toast.show(response.message || "Reserva cancelada", "success");
    await cargarCitas();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function cargarCitas() {
  const container = document.getElementById("listaCitas");

  try {
    const data = await API.get("/cliente/reservas", sessionCitas.token);
    todasLasReservas = data.reservas || [];
    renderLista();
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar tus citas: ${escapeHtml(error.message)}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarCitas();

  document.querySelectorAll(".filtro-citas").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-citas").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filtroActivo = btn.dataset.filtro;
      renderLista();
    });
  });

  document.getElementById("listaCitas").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cita-action]");
    if (!button) return;

    const actions = {
      reprogramar: toggleReprogramar,
      cancelar: cancelarReserva,
      guardar: confirmarReprogramar
    };
    await actions[button.dataset.citaAction]?.(button.dataset.reservaId);
  });
});
