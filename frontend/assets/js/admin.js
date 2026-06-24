const sessionAdmin = AUTH.requireSession();

async function cargarReporte() {
  const data = await API.get("/admin/reporte-financiero", sessionAdmin.token);

  document.getElementById("reporte").innerHTML = `
    <div class="row-item">Total reservas: ${data.totalReservas || 0}</div>
    <div class="row-item">Reservas online: ${data.online || 0}</div>
    <div class="row-item">Reservas presenciales: ${data.presenciales || 0}</div>
  `;
}

async function cargarServicios() {
  const data = await API.get("/admin/servicios", sessionAdmin.token);
  const servicios = data.servicios || [];

  document.getElementById("servicios").innerHTML = servicios.length
    ? servicios.map(item => `<div class="row-item">${item.nombre}: S/ ${item.precio}</div>`).join("")
    : "<div class='row-item'>No hay servicios configurados.</div>";
}

async function guardarServicio(event) {
  event.preventDefault();
  await API.post("/admin/servicios", {
    nombre: document.getElementById("nombreServicio").value,
    precio: Number(document.getElementById("precioServicio").value)
  }, sessionAdmin.token);
  await cargarServicios();
}

async function crearPersonal(event) {
  event.preventDefault();
  const response = await API.post("/admin/personal", {
    nombre: document.getElementById("nombrePersonal").value,
    email: document.getElementById("emailPersonal").value,
    rol: document.getElementById("rolPersonal").value,
    password: document.getElementById("passwordPersonal").value
  }, sessionAdmin.token);

  document.getElementById("personal").innerText = response.userId
    ? `Usuario creado: ${response.email}`
    : response.error;
}

async function cargarGlobal() {
  const [agenda, inventario, insumos, pos] = await Promise.all([
    API.get("/admin/agenda", sessionAdmin.token),
    API.get("/admin/inventario", sessionAdmin.token),
    API.get("/admin/insumos", sessionAdmin.token),
    API.get("/admin/pos", sessionAdmin.token)
  ]);

  document.getElementById("global").innerHTML = `
    <div class="row-item">Citas globales: ${(agenda.citas || []).length}</div>
    <div class="row-item">Productos inventario: ${(inventario.inventario || []).length}</div>
    <div class="row-item">Consumos insumos: ${(insumos.insumos || []).length}</div>
    <div class="row-item">Caja total: S/ ${pos.total || 0}</div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  cargarReporte();
  cargarServicios();
  cargarGlobal();
  document.getElementById("formServicio").addEventListener("submit", guardarServicio);
  document.getElementById("formPersonal").addEventListener("submit", crearPersonal);
});
