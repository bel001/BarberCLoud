const sessionAdminConfig = AUTH.requireSession();

function mostrarIdentidadAdminConfig() {
  const nombre = sessionAdminConfig.name || sessionAdminConfig.email || "Administrador";
  document.getElementById("infoNombre").textContent = nombre;
  document.getElementById("infoEmail").textContent = sessionAdminConfig.email || "-";
  document.getElementById("adminNombre").textContent = nombre;
  document.getElementById("adminAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cambiarPasswordAdmin(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const passwordActual = document.getElementById("passwordActual").value;
    const passwordNueva = document.getElementById("passwordNueva").value;

    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/cambiar-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionAdminConfig.token}`
      },
      body: JSON.stringify({ passwordActual, passwordNueva })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo cambiar la contraseña");
    }

    Toast.show(data.message || "Contraseña actualizada", "success");
    document.getElementById("formPassword").reset();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function cargarEstado2fa() {
  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/estado`, {
      headers: { Authorization: `Bearer ${sessionAdminConfig.token}` }
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
      headers: { Authorization: `Bearer ${sessionAdminConfig.token}` }
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionAdminConfig.token}` },
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionAdminConfig.token}` },
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
  mostrarIdentidadAdminConfig();

  if (!AUTH.enableLocalAuthControls()) return;

  cargarEstado2fa();

  document.getElementById("formPassword").addEventListener("submit", cambiarPasswordAdmin);
  document.getElementById("btnIniciar2fa").addEventListener("click", iniciar2fa);
  document.getElementById("btnConfirmar2fa").addEventListener("click", confirmar2fa);
  document.getElementById("btnDesactivar2fa").addEventListener("click", desactivar2fa);
});
