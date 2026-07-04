const session = AUTH.requireSession();

// Escapar HTML para prevenir XSS
const escapeHtml = (str) => {
  if (str == null) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
};

async function cargarReservas() {
  if (!session) return;

  const data = await API.get("/cliente/reservas", session.token);
  const contenedor = document.getElementById("reservas");

  if (!Array.isArray(data) || data.length === 0) {
    contenedor.innerHTML = "<div class='row-item'>Aún no tienes reservas.</div>";
    return;
  }

  contenedor.innerHTML = data.map(item => `
    <div class="row-item">
      <strong>${escapeHtml(item.fecha)} ${escapeHtml(item.hora)}</strong><br>
      Servicio: ${escapeHtml(item.servicioId)}<br>
      Estado: ${escapeHtml(item.estado)}<br>
      ${item.estado !== "CANCELADA" ? `<button class="btn-secondary" onclick="cancelarReserva('${escapeHtml(item.reservaId)}')">Cancelar</button>` : ""}
    </div>
  `).join("");
}

async function confirmarPendiente() {
  const raw = localStorage.getItem("reserva_pendiente");

  if (!raw) {
    document.getElementById("resultado").innerText = "No hay reserva pendiente.";
    return;
  }

  const payload = JSON.parse(raw);
  const response = await API.post("/reservas", payload, session.token);

  if (response.reservaId) {
    localStorage.removeItem("reserva_pendiente");
    document.getElementById("resultado").innerText = `Reserva confirmada: ${response.reservaId}`;
    cargarReservas();
  } else {
    document.getElementById("resultado").innerText = response.error;
  }
}

async function cancelarReserva(reservaId) {
  const response = await API.post(`/reservas/${reservaId}/cancelar`, {}, session.token);
  document.getElementById("resultado").innerText = response.message || response.error;
  await cargarReservas();
}

document.addEventListener("DOMContentLoaded", cargarReservas);