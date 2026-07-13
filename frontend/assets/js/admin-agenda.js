const sessionAgendaAdmin = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = sessionAgendaAdmin.name || sessionAgendaAdmin.email || "Administrador";
  document.getElementById("adminNombre").textContent = nombre;
  document.getElementById("adminAvatar").textContent = nombre.charAt(0).toUpperCase();
}

function estadoBadge(estado) {
  const badges = { CONFIRMADA: "info", EN_PROCESO: "warning", FINALIZADO: "success", CANCELADA: "danger" };
  return badges[estado] || "info";
}

function estadoLabel(estado) {
  const labels = { CONFIRMADA: "Programada", EN_PROCESO: "En proceso", FINALIZADO: "Finalizado", CANCELADA: "Cancelada" };
  return labels[estado] || estado;
}

function estadoAcciones(cita, barberoId) {
  if (cita.estado === "CONFIRMADA") {
    return `
      <div class="list-item-actions list-item-actions-spaced">
        <button class="btn btn-secondary btn-sm" type="button" data-reserva-id="${escapeHtml(cita.reservaId)}" data-barbero-id="${escapeHtml(barberoId)}" data-cambiar-estado="EN_PROCESO">Iniciar</button>
        <button class="btn btn-secondary btn-sm" type="button" data-reserva-id="${escapeHtml(cita.reservaId)}" data-barbero-id="${escapeHtml(barberoId)}" data-cambiar-estado="CANCELADA">Cancelar</button>
      </div>
    `;
  }

  if (cita.estado === "EN_PROCESO") {
    return `
      <div class="list-item-actions list-item-actions-spaced">
        <button class="btn btn-primary btn-sm" type="button" data-reserva-id="${escapeHtml(cita.reservaId)}" data-barbero-id="${escapeHtml(barberoId)}" data-cambiar-estado="FINALIZADO">Finalizar</button>
      </div>
    `;
  }

  return "";
}

async function cargarAgendaAdmin() {
  const grid = document.getElementById("agendaAdminGrid");
  const fechaFiltro = document.getElementById("filtroFecha").value;

  try {
    const [agendaData, disponibilidadData] = await Promise.all([
      API.get("/admin/agenda", sessionAgendaAdmin.token),
      API.get("/disponibilidad")
    ]);

    const nombresBarberos = {};
    (disponibilidadData.barberos || []).forEach(b => { nombresBarberos[b.id] = b.nombre; });

    const citas = (agendaData.citas || []).filter(c => !fechaFiltro || c.fecha === fechaFiltro);

    const porBarbero = {};
    citas.forEach(cita => {
      const id = cita.barberoId || "sin-asignar";
      if (!porBarbero[id]) porBarbero[id] = [];
      porBarbero[id].push(cita);
    });

    const barberoIds = Object.keys(porBarbero).sort();

    if (barberoIds.length === 0) {
      grid.innerHTML = `<p class="text-muted text-sm">No hay citas para esta fecha.</p>`;
      return;
    }

    grid.innerHTML = barberoIds.map(barberoId => {
      const citasBarbero = porBarbero[barberoId].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));

      return `
        <div class="barber-panel">
          <div class="barber-panel-header">
            <h3>${escapeHtml(nombresBarberos[barberoId] || barberoId)}</h3>
          </div>
          <div class="flex flex-col gap-2">
            ${citasBarbero.map(cita => `
              <div class="list-item stacked-list-item">
                <div class="appointment-summary">
                  <div class="list-item-info">
                    <div class="list-item-title">${escapeHtml(cita.clienteNombre)}</div>
                    <div class="list-item-subtitle">📅 ${escapeHtml(cita.fecha)} • ⏰ ${escapeHtml(cita.hora)} • ${escapeHtml(cita.servicioNombre || cita.servicioId)}</div>
                  </div>
                  <span class="badge badge-${estadoBadge(cita.estado)}">${escapeHtml(estadoLabel(cita.estado))}</span>
                </div>
                ${estadoAcciones(cita, barberoId)}
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll("[data-cambiar-estado]").forEach(btn => {
      btn.addEventListener("click", () => cambiarEstadoCitaAdmin(btn.dataset.reservaId, btn.dataset.barberoId, btn.dataset.cambiarEstado));
    });
  } catch (error) {
    grid.innerHTML = `<div class="alert alert-error">Error al cargar la agenda: ${escapeHtml(error.message)}</div>`;
  }
}

async function cambiarEstadoCitaAdmin(reservaId, barberoId, estado) {
  try {
    const response = await API.post(`/admin/citas/${reservaId}/estado`, { estado, barberoId }, sessionAgendaAdmin.token);
    Toast.show(response.message || "Estado actualizado", "success");
    await cargarAgendaAdmin();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarAgendaAdmin();
  document.getElementById("filtroFecha").addEventListener("change", cargarAgendaAdmin);
});
