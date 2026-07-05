const sessionSecretaria = AUTH.requireSession();

async function registrarCitaPresencial(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const payload = {
      clienteCorreo: document.getElementById("clienteCorreo").value,
      servicioId: document.getElementById("servicioId").value,
      barberoId: document.getElementById("barberoId").value,
      fecha: document.getElementById("fecha").value,
      hora: document.getElementById("hora").value
    };

    const response = await API.post("/secretaria/reservas-presenciales", payload, sessionSecretaria.token);

    if (response.reservaId) {
      Toast.show("Cita presencial registrada: " + response.reservaId, "success");
      document.getElementById("formPresencial").reset();
    } else {
      Toast.show(response.error || "Error al registrar", "error");
    }
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function cargarPOS() {
  try {
    const data = await API.get("/secretaria/pos", sessionSecretaria.token);
    const ventas = data.ventas || [];

    const posContainer = document.getElementById("pos");
    const ventasHtml = ventas.length
      ? ventas.map(venta => `<div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(venta.concepto)}</div>
            <div class="list-item-subtitle">S/ ${escapeHtml(venta.total)}</div>
          </div>
        </div>`).join("")
      : `<p class="text-muted text-sm">Sin ventas registradas</p>`;

    posContainer.innerHTML = `
      <div class="stat-card mb-4">
        <span class="stat-label">Total en caja</span>
        <span class="stat-value">S/ <span id="caja-total">${data.total || 0}</span></span>
      </div>
      ${ventasHtml}
    `;
  } catch (error) {
    Toast.show("Error al cargar POS: " + error.message, "error");
  }
}

async function registrarVenta(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    await API.post("/secretaria/pos", {
      concepto: document.getElementById("conceptoVenta").value,
      total: Number(document.getElementById("totalVenta").value)
    }, sessionSecretaria.token);

    Toast.show("Venta registrada correctamente", "success");
    document.getElementById("formVenta").reset();
    await cargarPOS();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function cargarInventario() {
  try {
    const data = await API.get("/secretaria/inventario", sessionSecretaria.token);
    const inventario = data.inventario || [];
    const container = document.getElementById("inventario");

    if (inventario.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm">No hay productos registrados</p>`;
      return;
    }

    container.innerHTML = inventario.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(item.nombre)}</div>
          <div class="list-item-subtitle">Stock: ${escapeHtml(item.stock)} unidades</div>
        </div>
        <span class="badge badge-${item.stock < 5 ? 'warning' : 'info'}">${item.stock} u.</span>
      </div>
    `).join("");
  } catch (error) {
    Toast.show("Error al cargar inventario: " + error.message, "error");
  }
}

async function guardarInventario(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    await API.post("/secretaria/inventario", {
      nombre: document.getElementById("nombreProducto").value,
      stock: Number(document.getElementById("stockProducto").value),
      precio: Number(document.getElementById("precioProducto").value)
    }, sessionSecretaria.token);

    Toast.show("Inventario actualizado", "success");
    document.getElementById("formInventario").reset();
    await cargarInventario();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fecha").valueAsDate = new Date();
  document.getElementById("formPresencial").addEventListener("submit", registrarCitaPresencial);
  document.getElementById("formVenta").addEventListener("submit", registrarVenta);
  document.getElementById("formInventario").addEventListener("submit", guardarInventario);
  cargarPOS();
  cargarInventario();
});
