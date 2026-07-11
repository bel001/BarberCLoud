const session = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = session.name || session.email || "Cliente";
  document.getElementById("clienteNombre").textContent = nombre;
  document.getElementById("clienteAvatar").textContent = nombre.charAt(0).toUpperCase();
}

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
  return reserva.estado === "CONFIRMADA" && new Date(`${reserva.fecha}T${reserva.hora}:00Z`).getTime() > Date.now();
}

async function cargarDashboard() {
  document.getElementById("saludoCliente").textContent = `Hola, ${session.name || "cliente"}`;

  const container = document.getElementById("reservas");

  try {
    const data = await API.get("/cliente/reservas", session.token);
    const reservas = data.reservas || [];

    document.getElementById("statPuntos").textContent = data.puntos || 0;

    const proximas = reservas.filter(esFutura).sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
    const proxima = proximas[0];

    document.getElementById("statProximaCita").textContent = proxima
      ? `${formatDate(proxima.fecha)} · ${formatHora12h(proxima.hora)}`
      : "Sin citas próximas";

    if (reservas.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:64px;height:64px;margin:0 auto 16px;color:var(--text-muted);">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p class="text-muted">Aún no tienes reservas</p>
          <a class="btn btn-primary mt-4" href="reservar.html" style="display:inline-flex;">Reservar ahora</a>
        </div>
      `;
      return;
    }

    const recientes = [...reservas]
      .sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`))
      .slice(0, 3);

    container.innerHTML = recientes.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">
            ${escapeHtml(item.servicioNombre || item.servicioId)}
            <span class="badge badge-${getEstadoBadge(item.estado)}">${escapeHtml(item.estado)}</span>
          </div>
          <div class="list-item-subtitle">
            📅 ${escapeHtml(item.fecha)} • ⏰ ${escapeHtml(formatHora12h(item.hora))}
          </div>
        </div>
      </div>
    `).join("");
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar reservas: ${escapeHtml(error.message)}</div>`;
  }
}

async function confirmarPendiente() {
  const raw = localStorage.getItem("reserva_pendiente");

  if (!raw) {
    Toast.show("No hay reserva pendiente", "warning");
    return;
  }

  try {
    const payload = JSON.parse(raw);
    const response = await API.post("/reservas", payload, session.token);

    if (response.reservaId) {
      localStorage.removeItem("reserva_pendiente");
      Toast.show(`Reserva confirmada: ${response.reservaId}`, "success");
      cargarDashboard();
    } else {
      Toast.show(response.error || "Error al confirmar", "error");
    }
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarDashboard();
  document.getElementById("confirmarPendienteBtn")?.addEventListener("click", confirmarPendiente);
});
