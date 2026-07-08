const sessionAdmin = AUTH.requireSession();

async function cargarReporte() {
  try {
    const data = await API.get("/admin/reporte-financiero", sessionAdmin.token);

    document.getElementById("reporte").innerHTML = `
      <div class="stat-card">
        <span class="stat-label">Total reservas</span>
        <span class="stat-value">${data.totalReservas || 0}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Online</span>
        <span class="stat-value">${data.online || 0}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Presenciales</span>
        <span class="stat-value">${data.presenciales || 0}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Ingresos</span>
        <span class="stat-value">S/ ${data.ingresosEstimados || 0}</span>
      </div>
    `;
  } catch (error) {
    Toast.show("Error al cargar reporte: " + error.message, "error");
  }
}

async function cargarServicios() {
  try {
    const data = await API.get("/admin/servicios", sessionAdmin.token);
    const servicios = data.servicios || [];
    const container = document.getElementById("servicios");

    if (servicios.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm">No hay servicios configurados</p>`;
      return;
    }

    container.innerHTML = servicios.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(item.nombre)}</div>
          <div class="list-item-subtitle">S/ ${escapeHtml(item.precio)}</div>
        </div>
      </div>
    `).join("");
  } catch (error) {
    Toast.show("Error al cargar servicios: " + error.message, "error");
  }
}

async function guardarServicio(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    await API.post("/admin/servicios", {
      nombre: document.getElementById("nombreServicio").value,
      precio: Number(document.getElementById("precioServicio").value)
    }, sessionAdmin.token);

    Toast.show("Servicio guardado correctamente", "success");
    document.getElementById("formServicio").reset();
    await cargarServicios();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function crearPersonal(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const response = await API.post("/admin/personal", {
      nombre: document.getElementById("nombrePersonal").value,
      email: document.getElementById("emailPersonal").value,
      rol: document.getElementById("rolPersonal").value,
      password: document.getElementById("passwordPersonal").value
    }, sessionAdmin.token);

    if (response.userId) {
      Toast.show("Usuario creado: " + response.email, "success");
      document.getElementById("formPersonal").reset();
      document.getElementById("personal").innerHTML = "";
    } else {
      Toast.show(response.error || "Error al crear usuario", "error");
    }
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

function getClienteReserva(cita) {
  return cita.clienteNombre || cita.clienteCorreo || cita.clienteId || "Cliente sin nombre";
}

function renderAgendaGlobal(citas) {
  const container = document.getElementById("agendaGlobal");

  if (!container) return;

  if (citas.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">No hay citas registradas.</p>`;
    return;
  }

  container.innerHTML = citas.slice(0, 6).map(cita => `
    <div class="list-item">
      <div class="list-item-info">
        <div class="list-item-title">${escapeHtml(getClienteReserva(cita))}</div>
        <div class="list-item-subtitle">
          ${escapeHtml(cita.servicioNombre || cita.servicioId || "Servicio")} · ${escapeHtml(cita.fecha)} · ${escapeHtml(cita.hora)}
        </div>
      </div>
      <span class="badge badge-${cita.estado === "CANCELADA" ? "danger" : "success"}">${escapeHtml(cita.estado || "CONFIRMADA")}</span>
    </div>
  `).join("");
}

async function cargarGlobal() {
  try {
    const [agenda, inventario, insumos, pos] = await Promise.all([
      API.get("/admin/agenda", sessionAdmin.token),
      API.get("/admin/inventario", sessionAdmin.token),
      API.get("/admin/insumos", sessionAdmin.token),
      API.get("/admin/pos", sessionAdmin.token)
    ]);

    const totalCitas = (agenda.citas || []).length;
    const totalProductos = (inventario.inventario || []).length;
    const totalConsumos = (insumos.insumos || []).length;
    const cajaTotal = pos.total || 0;
    const citas = agenda.citas || [];

    document.getElementById("global").innerHTML = `
      <div class="stat-card">
        <span class="stat-label">Citas globales</span>
        <span class="stat-value">${totalCitas}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Productos</span>
        <span class="stat-value">${totalProductos}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Consumos</span>
        <span class="stat-value">${totalConsumos}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Caja total</span>
        <span class="stat-value">S/ ${cajaTotal}</span>
      </div>
    `;

    renderAgendaGlobal(citas);
  } catch (error) {
    Toast.show("Error al cargar datos globales: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarReporte();
  cargarServicios();
  cargarGlobal();
  document.getElementById("formServicio").addEventListener("submit", guardarServicio);
  document.getElementById("formPersonal").addEventListener("submit", crearPersonal);
});
