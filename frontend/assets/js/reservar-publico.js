async function cargarDisponibilidadPublica() {
  const data = await API.get("/disponibilidad");

  document.getElementById("servicioId").innerHTML = data.servicios
    .map(servicio => `<option value="${servicio.id}">${servicio.nombre} - S/ ${servicio.precio}</option>`)
    .join("");

  document.getElementById("barberoId").innerHTML = data.barberos
    .map(barbero => `<option value="${barbero.id}">${barbero.nombre}</option>`)
    .join("");

  document.getElementById("hora").innerHTML = data.horarios
    .map(hora => `<option value="${hora}">${hora}</option>`)
    .join("");

  document.getElementById("fecha").valueAsDate = new Date();
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
