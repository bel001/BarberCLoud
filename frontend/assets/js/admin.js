const sessionAdmin = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = sessionAdmin.name || sessionAdmin.email || "Administrador";
  document.getElementById("adminNombre").textContent = nombre;
  document.getElementById("adminAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarStats() {
  try {
    const [reporte, config] = await Promise.all([
      API.get("/admin/reporte-financiero", sessionAdmin.token),
      API.get("/admin/config-negocio", sessionAdmin.token)
    ]);

    document.getElementById("statTotalReservas").textContent = reporte.totalReservas || 0;
    document.getElementById("statOnlinePresencial").textContent = `${reporte.online || 0} / ${reporte.presenciales || 0}`;
    document.getElementById("statIngresos").textContent = `S/ ${reporte.ingresosEstimados || 0}`;

    const cfg = config.config || config;
    document.getElementById("statComision").textContent = `${cfg.comisionPorcentaje}%`;
    document.getElementById("resumenPolitica").textContent =
      `Comisión ${cfg.comisionPorcentaje}% · Penalización ${cfg.penalizacionPorcentaje}% tras ${cfg.horasParaPenalizacion}h · Anticipación ${cfg.anticipacionMinimaHoras}h a ${cfg.anticipacionMaximaDias}d`;
  } catch (error) {
    Toast.show("Error al cargar estadísticas: " + error.message, "error");
  }
}

async function cargarGrafico() {
  try {
    const data = await API.get("/admin/dashboard-financiero", sessionAdmin.token);
    const meses = data.ingresosPorMes || [];
    const container = document.getElementById("graficoIngresos");

    if (meses.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm">Aún no hay ingresos registrados.</p>`;
      return;
    }

    const maximo = Math.max(...meses.map(item => item.ingresos), 1);

    container.innerHTML = meses.map(item => `
      <div class="chart-bar-wrap">
        <span class="chart-bar-value">S/ ${item.ingresos}</span>
        <div class="chart-bar" data-height="${Math.round((item.ingresos / maximo) * 100)}"></div>
        <span class="chart-bar-label">${escapeHtml(item.mes)}</span>
      </div>
    `).join("");

    container.querySelectorAll(".chart-bar").forEach(bar => {
      bar.style.setProperty("--bar-height", `${bar.dataset.height}%`);
    });
  } catch (error) {
    Toast.show("Error al cargar el gráfico: " + error.message, "error");
  }
}

async function cargarPersonal() {
  try {
    const data = await API.get("/admin/personal", sessionAdmin.token);
    const personal = data.personal || [];
    const activos = personal.filter(p => p.estado !== "INACTIVO").length;
    const bajas = personal.length - activos;

    document.getElementById("resumenPersonal").textContent =
      personal.length
        ? `${personal.length} miembros registrados · ${activos} activos · ${bajas} de baja`
        : "No hay personal registrado todavía.";
  } catch (error) {
    Toast.show("Error al cargar personal: " + error.message, "error");
  }
}

async function cargarActividad() {
  try {
    const data = await API.get("/admin/actividad", sessionAdmin.token);
    const actividad = data.actividad || [];
    const container = document.getElementById("flujoActividad");

    container.innerHTML = actividad.length
      ? actividad.map(item => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(item.action)} <span class="badge ${item.status === "OK" ? "badge-success" : "badge-danger"}">${escapeHtml(item.status)}</span></div>
            <div class="list-item-subtitle">${escapeHtml(item.responsable)} (${escapeHtml(item.rol)}) · ${escapeHtml(new Date(item.creadoEn).toLocaleString())}</div>
          </div>
        </div>
      `).join("")
      : `<p class="text-muted text-sm">Sin actividad registrada.</p>`;
  } catch (error) {
    Toast.show("Error al cargar actividad: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarStats();
  cargarGrafico();
  cargarPersonal();
  cargarActividad();
});
