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

async function cargarEstado2fa() {
  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/estado`, {
      headers: { Authorization: `Bearer ${sessionBarberoConfig.token}` }
    });
    const data = await response.json();

    document.getElementById("estado2faDesactivado").classList.toggle("hidden", data.habilitado);
    document.getElementById("panelConfigurar2fa").classList.add("hidden");
    document.getElementById("estado2faActivado").classList.toggle("hidden", !data.habilitado);
  } catch (error) {
    Toast.show("Error al cargar el estado de 2FA: " + error.message, "error");
  }
}

async function iniciar2fa() {
  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/iniciar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionBarberoConfig.token}` }
    });
    const data = await response.json();

    document.getElementById("secreto2fa").textContent = data.secret;
    document.getElementById("estado2faDesactivado").classList.add("hidden");
    document.getElementById("panelConfigurar2fa").classList.remove("hidden");
  } catch (error) {
    Toast.show("Error al iniciar 2FA: " + error.message, "error");
  }
}

async function confirmar2fa() {
  const codigo = document.getElementById("codigoConfirmar2fa").value;

  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionBarberoConfig.token}` },
      body: JSON.stringify({ codigo })
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    Toast.show(data.message, "success");
    await cargarEstado2fa();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function desactivar2fa() {
  const codigo = document.getElementById("codigoDesactivar2fa").value;

  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/desactivar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionBarberoConfig.token}` },
      body: JSON.stringify({ codigo })
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    Toast.show(data.message, "success");
    await cargarEstado2fa();
  } catch (error) {
    Toast.show(error.message, "error");
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

  cargarEstado2fa();

  document.getElementById("btnIniciar2fa").addEventListener("click", iniciar2fa);
  document.getElementById("btnConfirmar2fa").addEventListener("click", confirmar2fa);
  document.getElementById("btnDesactivar2fa").addEventListener("click", desactivar2fa);
});
