const sessionRecompensas = AUTH.requireSession();

let puntosActuales = 0;

function mostrarIdentidad() {
  const nombre = sessionRecompensas.name || sessionRecompensas.email || "Cliente";
  document.getElementById("clienteNombre").textContent = nombre;
  document.getElementById("clienteAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarCatalogo() {
  try {
    const data = await API.get("/cliente/recompensas", sessionRecompensas.token);
    const catalogo = data.catalogo || [];

    document.getElementById("catalogoRecompensas").innerHTML = catalogo.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(item.nombre)}</div>
          <div class="list-item-subtitle">${escapeHtml(item.puntos)} puntos</div>
        </div>
        <button class="btn btn-primary btn-sm" type="button" data-recompensa-id="${escapeHtml(item.id)}" ${puntosActuales < item.puntos ? "disabled" : ""}>
          Canjear
        </button>
      </div>
    `).join("");

    document.querySelectorAll("[data-recompensa-id]").forEach(btn => {
      btn.addEventListener("click", () => canjearRecompensa(btn.dataset.recompensaId));
    });
  } catch (error) {
    Toast.show("Error al cargar recompensas: " + error.message, "error");
  }
}

async function canjearRecompensa(recompensaId) {
  if (!confirm("¿Canjear esta recompensa?")) return;

  try {
    const response = await API.post("/cliente/recompensas", { recompensaId }, sessionRecompensas.token);
    Toast.show(`${response.message} · Código: ${response.codigo}`, "success");
    await cargarTodo();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function cargarHistorial() {
  try {
    const data = await API.get("/cliente/reservas", sessionRecompensas.token);
    puntosActuales = data.puntos || 0;
    document.getElementById("statPuntosRecompensas").textContent = puntosActuales;

    const reservas = (data.reservas || []).sort((a, b) => `${b.fecha}${b.hora}`.localeCompare(`${a.fecha}${a.hora}`));

    document.getElementById("historialPuntos").innerHTML = reservas.length
      ? reservas.map(item => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">+10 puntos</div>
            <div class="list-item-subtitle">Reserva del ${escapeHtml(item.fecha)} · ${escapeHtml(item.servicioNombre || item.servicioId)}</div>
          </div>
        </div>
      `).join("")
      : `<p class="text-muted text-sm">Aún no has ganado puntos.</p>`;

    const canjes = data.canjes || [];

    document.getElementById("historialCanjes").innerHTML = canjes.length
      ? canjes.map(item => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(item.recompensaNombre)}</div>
            <div class="list-item-subtitle">Código: ${escapeHtml(item.codigo)} · -${escapeHtml(item.puntosUsados)} puntos</div>
          </div>
        </div>
      `).join("")
      : `<p class="text-muted text-sm">Aún no has canjeado recompensas.</p>`;
  } catch (error) {
    Toast.show("Error al cargar tu historial: " + error.message, "error");
  }
}

async function cargarTodo() {
  await cargarHistorial();
  await cargarCatalogo();
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarTodo();
});
