const sessionPos = AUTH.requireSession();
const IGV_RATE = 0.18;

function mostrarIdentidad() {
  const nombre = sessionPos.name || sessionPos.email || "Secretaria";
  document.getElementById("secretariaNombre").textContent = nombre;
  document.getElementById("secretariaAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarProductos() {
  try {
    const data = await API.get("/secretaria/inventario", sessionPos.token);
    const productos = data.inventario || [];

    document.getElementById("productoVenta").innerHTML = `<option value="">Concepto libre</option>` +
      productos.map(p => `<option value="${escapeHtml(p.nombre)}" data-precio="${escapeHtml(p.precio)}">${escapeHtml(p.nombre)} · S/ ${escapeHtml(p.precio)}</option>`).join("");
  } catch (error) {
    Toast.show("Error al cargar productos: " + error.message, "error");
  }
}

function actualizarPreviewImpuesto() {
  const subtotal = Number(document.getElementById("totalVenta").value || 0);
  const impuesto = Math.round(subtotal * IGV_RATE * 100) / 100;
  const total = Math.round((subtotal + impuesto) * 100) / 100;
  document.getElementById("previewImpuesto").textContent = `IGV (18%): S/ ${impuesto} · Total: S/ ${total}`;
}

async function cargarPOS() {
  try {
    const data = await API.get("/secretaria/pos", sessionPos.token);
    const ventas = data.ventas || [];

    document.getElementById("statTotalCajaPos").textContent = `S/ ${data.total || 0}`;

    const sesion = data.sesionCaja;
    document.getElementById("statEstadoCaja").textContent = sesion ? "Abierta" : "Cerrada";
    document.getElementById("formAbrirCaja").classList.toggle("hidden", Boolean(sesion));
    document.getElementById("formCerrarCaja").classList.toggle("hidden", !sesion);

    if (sesion) {
      document.getElementById("montoInicialActual").textContent = sesion.montoInicial;
    }

    const container = document.getElementById("listaVentas");

    container.innerHTML = ventas.length
      ? ventas.slice().reverse().map(venta => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(venta.concepto)} <span class="badge badge-info">${escapeHtml(venta.metodoPago)}</span></div>
            <div class="list-item-subtitle">S/ ${escapeHtml(venta.total)} + IGV S/ ${escapeHtml(venta.impuesto ?? 0)} = S/ ${escapeHtml(venta.totalConImpuesto ?? venta.total)}</div>
          </div>
        </div>
      `).join("")
      : `<p class="text-muted text-sm">Sin ventas registradas hoy.</p>`;
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
      total: Number(document.getElementById("totalVenta").value),
      metodoPago: document.getElementById("metodoPago").value
    }, sessionPos.token);

    Toast.show("Venta registrada correctamente", "success");
    document.getElementById("formVenta").reset();
    actualizarPreviewImpuesto();
    await cargarPOS();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function abrirCaja() {
  try {
    const montoInicial = Number(document.getElementById("montoInicial").value || 0);
    const response = await API.post("/secretaria/caja/abrir", { montoInicial }, sessionPos.token);
    Toast.show(response.message, "success");
    await cargarPOS();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function cerrarCaja() {
  try {
    const montoContado = Number(document.getElementById("montoContado").value || 0);
    const response = await API.post("/secretaria/caja/cerrar", { montoContado }, sessionPos.token);
    Toast.show(`${response.message} · Diferencia: S/ ${response.diferencia}`, response.diferencia === 0 ? "success" : "warning");
    await cargarPOS();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarProductos();
  cargarPOS();

  document.getElementById("formVenta").addEventListener("submit", registrarVenta);
  document.getElementById("totalVenta").addEventListener("input", actualizarPreviewImpuesto);
  document.getElementById("btnAbrirCaja").addEventListener("click", abrirCaja);
  document.getElementById("btnCerrarCaja").addEventListener("click", cerrarCaja);

  document.getElementById("productoVenta").addEventListener("change", (event) => {
    const opt = event.target.selectedOptions[0];
    const precio = opt?.dataset.precio;
    if (precio) {
      document.getElementById("conceptoVenta").value = opt.value;
      document.getElementById("totalVenta").value = precio;
      actualizarPreviewImpuesto();
    }
  });
});
