const sessionInventario = AUTH.requireSession();

let inventarioActual = [];

function mostrarIdentidad() {
  const nombre = sessionInventario.name || sessionInventario.email || "Secretaria";
  document.getElementById("secretariaNombre").textContent = nombre;
  document.getElementById("secretariaAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarInventario() {
  try {
    const data = await API.get("/secretaria/inventario", sessionInventario.token);
    inventarioActual = data.inventario || [];
    const container = document.getElementById("inventario");

    if (inventarioActual.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm">No hay productos registrados</p>`;
    } else {
      container.innerHTML = inventarioActual.map(item => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(item.nombre)}</div>
            <div class="list-item-subtitle">Stock: ${escapeHtml(item.stock)} unidades · S/ ${escapeHtml(item.precio)}</div>
          </div>
          <span class="badge badge-${item.stock < 5 ? 'warning' : 'info'}">${escapeHtml(item.stock)} u.</span>
        </div>
      `).join("");
    }

    document.getElementById("badgeStockBajo").textContent = `${inventarioActual.filter(i => i.stock < 5).length} con stock bajo`;

    document.getElementById("productoReponer").innerHTML = inventarioActual.map(item =>
      `<option value="${escapeHtml(item.productoId)}">${escapeHtml(item.nombre)} (stock: ${escapeHtml(item.stock)})</option>`
    ).join("");
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
    }, sessionInventario.token);

    Toast.show("Producto registrado", "success");
    document.getElementById("formInventario").reset();
    await cargarInventario();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function reponerStock(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const productoId = document.getElementById("productoReponer").value;
    const cantidad = Number(document.getElementById("cantidadReponer").value);
    const producto = inventarioActual.find(p => p.productoId === productoId);

    if (!producto) {
      Toast.show("Elige un producto válido", "warning");
      return;
    }

    await API.post("/secretaria/inventario", {
      productoId,
      nombre: producto.nombre,
      stock: producto.stock + cantidad,
      precio: producto.precio
    }, sessionInventario.token);

    Toast.show(`Se agregaron ${cantidad} unidades a ${producto.nombre}`, "success");
    document.getElementById("formReponer").reset();
    await cargarInventario();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarInventario();
  document.getElementById("formInventario").addEventListener("submit", guardarInventario);
  document.getElementById("formReponer").addEventListener("submit", reponerStock);
});
