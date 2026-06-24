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

async function cargarPOS() {
  const data = await API.get("/secretaria/pos", sessionSecretaria.token);
  document.getElementById("pos").innerHTML = `
    <div class="row-item">Total caja: S/ ${data.total || 0}</div>
    ${(data.ventas || []).map(venta => `<div class="row-item">${venta.concepto}: S/ ${venta.total}</div>`).join("")}
  `;
}

async function registrarVenta(event) {
  event.preventDefault();
  await API.post("/secretaria/pos", {
    concepto: document.getElementById("conceptoVenta").value,
    total: Number(document.getElementById("totalVenta").value)
  }, sessionSecretaria.token);
  await cargarPOS();
}

async function cargarInventario() {
  const data = await API.get("/secretaria/inventario", sessionSecretaria.token);
  const inventario = data.inventario || [];

  document.getElementById("inventario").innerHTML = inventario.length
    ? inventario.map(item => `<div class="row-item">${item.nombre}: ${item.stock} unidades</div>`).join("")
    : "<div class='row-item'>No hay productos registrados.</div>";
}

async function guardarInventario(event) {
  event.preventDefault();
  await API.post("/secretaria/inventario", {
    nombre: document.getElementById("nombreProducto").value,
    stock: Number(document.getElementById("stockProducto").value),
    precio: Number(document.getElementById("precioProducto").value)
  }, sessionSecretaria.token);
  await cargarInventario();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fecha").valueAsDate = new Date();
  document.getElementById("formPresencial").addEventListener("submit", registrarCitaPresencial);
  document.getElementById("formVenta").addEventListener("submit", registrarVenta);
  document.getElementById("formInventario").addEventListener("submit", guardarInventario);
  cargarPOS();
  cargarInventario();
});
