const sessionBarbero = AUTH.requireSession();

async function cargarAgenda() {
  const data = await API.get("/barbero/agenda", sessionBarbero.token);
  const citas = data.citas || [];

  document.getElementById("agenda").innerHTML = citas.length
    ? citas.map(cita => `<div class="row-item">${cita.fecha} ${cita.hora} - ${cita.clienteNombre}</div>`).join("")
    : "<div class='row-item'>No hay citas asignadas.</div>";
}

async function cargarInsumos() {
  const data = await API.get("/barbero/insumos", sessionBarbero.token);
  const insumos = data.insumos || [];

  document.getElementById("insumos").innerHTML = insumos.length
    ? insumos.map(item => `<div class="row-item">${item.nombre}: ${item.cantidad}</div>`).join("")
    : "<div class='row-item'>No hay consumos registrados.</div>";
}

async function registrarInsumo(event) {
  event.preventDefault();

  const payload = {
    insumoId: document.getElementById("insumoId").value,
    nombre: document.getElementById("nombreInsumo").value,
    cantidad: Number(document.getElementById("cantidadInsumo").value)
  };

  await API.post("/barbero/insumos", payload, sessionBarbero.token);
  await cargarInsumos();
}

document.addEventListener("DOMContentLoaded", () => {
  cargarAgenda();
  cargarInsumos();
  document.getElementById("formInsumo").addEventListener("submit", registrarInsumo);
});
