const sessionBarbero = AUTH.requireSession();

function mostrarIdentidadBarbero() {
  const nombre = sessionBarbero.name || sessionBarbero.email || "Barbero";
  document.getElementById("barberoNombre").textContent = nombre;
  document.getElementById("barberoAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarAgenda() {
  try {
    const data = await API.get("/barbero/agenda", sessionBarbero.token);
    const citas = data.citas || [];
    const container = document.getElementById("agenda");

    if (citas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
      <div class="appt-card stacked-list-item">
        <div class="appointment-summary">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(cita.clienteNombre)}</div>
            <div class="list-item-subtitle">
              📅 ${escapeHtml(cita.fecha)} • ⏰ ${escapeHtml(cita.hora)} • ${escapeHtml(cita.servicioNombre || cita.servicioId)}
            </div>
          </div>
          <span class="badge badge-${estadoBadge(cita.estado)}">${escapeHtml(estadoLabel(cita.estado))}</span>
        </div>
        ${estadoAcciones(cita)}
      </div>
    `).join("");

    document.querySelectorAll("[data-cambiar-estado]").forEach(btn => {
      btn.addEventListener("click", () => cambiarEstadoCita(btn.dataset.reservaId, btn.dataset.cambiarEstado));
    });
  } catch (error) {
    Toast.show("Error al cargar agenda: " + error.message, "error");
  }
}

function estadoBadge(estado) {
  const badges = { CONFIRMADA: "info", EN_PROCESO: "warning", FINALIZADO: "success", CANCELADA: "danger" };
  return badges[estado] || "info";
}

function estadoLabel(estado) {
  const labels = { CONFIRMADA: "Programada", EN_PROCESO: "En proceso", FINALIZADO: "Finalizado", CANCELADA: "Cancelada" };
  return labels[estado] || estado;
}

function estadoAcciones(cita) {
  if (cita.estado === "CONFIRMADA") {
    return `
      <div class="list-item-actions list-item-actions-spaced">
        <button class="btn btn-secondary btn-sm" type="button" data-reserva-id="${escapeHtml(cita.reservaId)}" data-cambiar-estado="EN_PROCESO">Iniciar</button>
        <button class="btn btn-secondary btn-sm" type="button" data-reserva-id="${escapeHtml(cita.reservaId)}" data-cambiar-estado="CANCELADA">Cancelar</button>
      </div>
    `;
  }

  if (cita.estado === "EN_PROCESO") {
    return `
      <div class="list-item-actions list-item-actions-spaced">
        <button class="btn btn-primary btn-sm" type="button" data-reserva-id="${escapeHtml(cita.reservaId)}" data-cambiar-estado="FINALIZADO">Finalizar</button>
      </div>
    `;
  }

  return "";
}

async function cambiarEstadoCita(reservaId, estado) {
  try {
    const response = await API.post(`/barbero/citas/${reservaId}/estado`, { estado }, sessionBarbero.token);
    Toast.show(response.message || "Estado actualizado", "success");
    await cargarAgenda();
  } catch (error) {
    Toast.show(error.message, "error");
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
  mostrarIdentidadBarbero();
  cargarAgenda();
  cargarInsumos();
  document.getElementById("formInsumo").addEventListener("submit", registrarInsumo);
});
