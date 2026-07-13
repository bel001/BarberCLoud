const sessionFinanciero = AUTH.requireSession();

let dashboardFinancieroData = null;

function mostrarIdentidad() {
  const nombre = sessionFinanciero.name || sessionFinanciero.email || "Administrador";
  document.getElementById("adminNombre").textContent = nombre;
  document.getElementById("adminAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarDashboardFinanciero() {
  try {
    const data = await API.get("/admin/dashboard-financiero", sessionFinanciero.token);
    dashboardFinancieroData = data;

    document.getElementById("statIngresosEstimados").textContent = `S/ ${data.ingresosEstimados || 0}`;
    document.getElementById("statCostos").textContent = `S/ ${data.costosInsumos || 0}`;
    document.getElementById("statNetos").textContent = `S/ ${data.ingresosNetos || 0}`;
    document.getElementById("statInventario").textContent = `S/ ${data.valorInventario || 0}`;

    renderGraficoIngresos(data.ingresosPorMes || []);
    renderGananciasBarbero(data.gananciasPorBarbero || []);
  } catch (error) {
    Toast.show("Error al cargar el dashboard financiero: " + error.message, "error");
  }
}

function renderGraficoIngresos(meses) {
  const container = document.getElementById("graficoIngresosMes");

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
}

function renderGananciasBarbero(ganancias) {
  const container = document.getElementById("gananciasBarbero");

  container.innerHTML = ganancias.length
    ? ganancias.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(item.barberoId)}</div>
        </div>
        <span class="stat-value text-lg">S/ ${item.ganancias}</span>
      </div>
    `).join("")
    : `<p class="text-muted text-sm">Aún no hay ganancias registradas.</p>`;
}

function exportarCsv() {
  if (!dashboardFinancieroData) return;

  const filas = [
    ["Métrica", "Valor"],
    ["Ingresos estimados", dashboardFinancieroData.ingresosEstimados || 0],
    ["Costos insumos", dashboardFinancieroData.costosInsumos || 0],
    ["Ingresos netos", dashboardFinancieroData.ingresosNetos || 0],
    ["Valor inventario", dashboardFinancieroData.valorInventario || 0],
    [],
    ["Mes", "Ingresos"],
    ...(dashboardFinancieroData.ingresosPorMes || []).map(item => [item.mes, item.ingresos]),
    [],
    ["Barbero", "Ganancias"],
    ...(dashboardFinancieroData.gananciasPorBarbero || []).map(item => [item.barberoId, item.ganancias])
  ];

  const csv = filas.map(fila => fila.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dashboard-financiero-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarDashboardFinanciero();
  document.getElementById("btnExportarCsv").addEventListener("click", exportarCsv);
});
