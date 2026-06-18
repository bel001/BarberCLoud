const sessionSecretaria = AUTH.requireSession();

async function registrarCitaPresencial(event) {
  event.preventDefault();

  const payload = {
    clienteCorreo: document.getElementById("clienteCorreo").value,
    servicioId: document.getElementById("servicioId").value,
    barberoId: document.getElementById("barberoId").value,
    fecha: document.getElementById("fecha").value,
    hora: document.getElementById("hora").value
  };

  const response = await API.post("/secretaria/reservas-presenciales", payload, sessionSecretaria.token);

  document.getElementById("resultado").innerText = response.reservaId
    ? `Cita presencial registrada: ${response.reservaId}`
    : response.error;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fecha").valueAsDate = new Date();
  document.getElementById("formPresencial").addEventListener("submit", registrarCitaPresencial);
});
