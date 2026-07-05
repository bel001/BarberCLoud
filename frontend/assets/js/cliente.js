const session = AUTH.requireSession();

const escapeHtml = (str) => {
  if (str == null) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

async function cargarReservas() {
  if (!session) return;

  const container = document.getElementById("reservas");

  try {
    const data = await API.get("/cliente/reservas", session.token);

    if (!Array.isArray(data) || data.length === 0) {
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

    container.innerHTML = data.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">
            ${escapeHtml(item.servicioId)}
            <span class="badge badge-${getEstadoBadge(item.estado)}">${escapeHtml(item.estado)}</span>
          </div>
          <div class="list-item-subtitle">
            📅 ${escapeHtml(item.fecha)} • ⏰ ${escapeHtml(item.hora)}
          </div>
        </div>
        ${item.estado !== "CANCELADA" ? `
          <div class="list-item-actions">
            <button class="btn btn-secondary btn-sm" onclick="cancelarReserva('${escapeHtml(item.reservaId)}')">
              Cancelar
            </button>
          </div>
        ` : ''}
      </div>
    `).join("");
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar reservas: ${escapeHtml(error.message)}</div>`;
  }
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
      cargarReservas();
    } else {
      Toast.show(response.error || "Error al confirmar", "error");
    }
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function cancelarReserva(reservaId) {
  if (!confirm("¿Cancelar esta reserva?")) return;

  try {
    const response = await API.post(`/reservas/${reservaId}/cancelar`, {}, session.token);
    Toast.show(response.message || "Reserva cancelada", "success");
    cargarReservas();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarReservas();
  document.getElementById("confirmarPendienteBtn")?.addEventListener("click", confirmarPendiente);
});
