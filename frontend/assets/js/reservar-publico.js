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

async function cargarDisponibilidadPublica() {
  const data = await API.get("/disponibilidad");

  document.getElementById("servicioId").innerHTML = data.servicios
    .map(servicio => `<option value="${escapeHtml(servicio.id)}">${escapeHtml(servicio.nombre)} - S/ ${escapeHtml(servicio.precio)}</option>`)
    .join("");

  document.getElementById("barberoId").innerHTML = data.barberos
    .map(barbero => `<option value="${escapeHtml(barbero.id)}">${escapeHtml(barbero.nombre)}</option>`)
    .join("");

  document.getElementById("hora").innerHTML = data.horarios
    .map(hora => `<option value="${escapeHtml(hora)}">${escapeHtml(hora)}</option>`)
    .join("");

  const fechaEl = document.getElementById("fecha");
  if (fechaEl) {
    fechaEl.valueAsDate = new Date();
  }
}

async function confirmarReservaPublica(event) {
  event.preventDefault();

  const reservaPendiente = {
    servicioId: document.getElementById("servicioId").value,
    barberoId: document.getElementById("barberoId").value,
    fecha: document.getElementById("fecha").value,
    hora: document.getElementById("hora").value
  };

  localStorage.setItem("reserva_pendiente", JSON.stringify(reservaPendiente));

  const session = AUTH.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  if (session.role !== "CLIENTE") {
    document.getElementById("resultado").innerText = "Solo una cuenta de cliente puede confirmar reservas online.";
    return;
  }

  const response = await API.post("/reservas", reservaPendiente, session.token);

  document.getElementById("resultado").innerText = response.reservaId
    ? `Reserva confirmada: ${response.reservaId}`
    : response.error;
}

document.addEventListener("DOMContentLoaded", () => {
  cargarDisponibilidadPublica();
  document.getElementById("formReservaPublica").addEventListener("submit", confirmarReservaPublica);
});