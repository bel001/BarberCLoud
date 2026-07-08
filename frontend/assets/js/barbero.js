const sessionBarbero = AUTH.requireSession();

function getClienteCita(cita) {
  return cita.clienteNombre || cita.clienteCorreo || cita.clienteId || "Cliente sin nombre";
}

async function cargarAgenda() {
  try {
    const data = await API.get("/barbero/agenda", sessionBarbero.token);
    const citas = data.citas || [];
    const container = document.getElementById("agenda");

    if (citas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin:0 auto 12px;">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No hay citas asignadas</p>
        </div>
      `;
      return;
    }

    container.innerHTML = citas.map(cita => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(getClienteCita(cita))}</div>
          <div class="list-item-subtitle">
            📅 ${escapeHtml(cita.fecha)} • ⏰ ${escapeHtml(cita.hora)}
          </div>
        </div>
        <span class="badge badge-info">Programada</span>
      </div>
    `).join("");
  } catch (error) {
    Toast.show("Error al cargar agenda: " + error.message, "error");
  }
}

async function cargarInsumos() {
  try {
    const data = await API.get("/barbero/insumos", sessionBarbero.token);
    const insumos = data.insumos || [];
    const container = document.getElementById("insumos");

    if (insumos.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm">No hay consumos registrados.</p>`;
      return;
    }

    container.innerHTML = insumos.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(item.nombre)}</div>
          <div class="list-item-subtitle">Cantidad: ${escapeHtml(item.cantidad)}</div>
        </div>
      </div>
    `).join("");
  } catch (error) {
    Toast.show("Error al cargar insumos: " + error.message, "error");
  }
}

async function registrarInsumo(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const payload = {
      insumoId: document.getElementById("insumoId").value,
      nombre: document.getElementById("nombreInsumo").value,
      cantidad: Number(document.getElementById("cantidadInsumo").value)
    };

    await API.post("/barbero/insumos", payload, sessionBarbero.token);
    Toast.show("Consumo registrado correctamente", "success");
    document.getElementById("formInsumo").reset();
    await cargarInsumos();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarAgenda();
  cargarInsumos();
  document.getElementById("formInsumo").addEventListener("submit", registrarInsumo);
});
