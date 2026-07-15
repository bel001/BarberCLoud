const sessionBarberoConfig = AUTH.requireSession();

function mostrarIdentidadConfig() {
  const nombre = sessionBarberoConfig.name || sessionBarberoConfig.email || "Barbero";
  document.getElementById("barberoNombre").textContent = nombre;
  document.getElementById("barberoAvatar").textContent = nombre.charAt(0).toUpperCase();
  document.getElementById("infoNombre").textContent = nombre;
  document.getElementById("infoEmail").textContent = sessionBarberoConfig.email || "-";
}

function cambiarTab(tab) {
  document.querySelectorAll(".config-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
  document.querySelectorAll(".config-panel").forEach(panel => panel.classList.toggle("hidden", panel.dataset.panel !== tab));
}

async function cargarGanancias() {
  try {
    const data = await API.get("/barbero/agenda", sessionBarberoConfig.token);
    const citas = data.citas || [];
    const ganancias = citas.filter(c => c.estado === "FINALIZADO").reduce((sum, c) => sum + Number(c.precio || 0), 0);
    document.getElementById("infoGanancias").textContent = `S/ ${ganancias}`;
  } catch (error) {
    Toast.show("Error al cargar facturación: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidadConfig();
  cargarGanancias();
  const hasLocalAuthControls = AUTH.enableLocalAuthControls();

  document.querySelectorAll(".config-tab").forEach(btn => {
    btn.addEventListener("click", () => cambiarTab(btn.dataset.tab));
  });

  if (!hasLocalAuthControls) return;

  cargarEstado2fa(sessionBarberoConfig);

  document.getElementById("btnIniciar2fa").addEventListener("click", () => iniciar2fa(sessionBarberoConfig));
  document.getElementById("btnConfirmar2fa").addEventListener("click", () => confirmar2fa(sessionBarberoConfig));
  document.getElementById("btnDesactivar2fa").addEventListener("click", () => desactivar2fa(sessionBarberoConfig));
});
