const sessionBarbero = AUTH.requireSession();

async function cargarAgenda() {
  const data = await API.get("/barbero/agenda", sessionBarbero.token);
  const citas = data.citas || [];

  document.getElementById("agenda").innerHTML = citas.length
    ? citas.map(cita => `<div class="row-item">${cita.fecha} ${cita.hora} - ${cita.clienteNombre}</div>`).join("")
    : "<div class='row-item'>No hay citas asignadas.</div>";
}

document.addEventListener("DOMContentLoaded", cargarAgenda);
