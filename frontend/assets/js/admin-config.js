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

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidadAdminConfig();

  if (!AUTH.enableLocalAuthControls()) return;

  cargarEstado2fa(sessionAdminConfig);

  document.getElementById("formPassword").addEventListener("submit", cambiarPasswordAdmin);
  document.getElementById("btnIniciar2fa").addEventListener("click", () => iniciar2fa(sessionAdminConfig));
  document.getElementById("btnConfirmar2fa").addEventListener("click", () => confirmar2fa(sessionAdminConfig));
  document.getElementById("btnDesactivar2fa").addEventListener("click", () => desactivar2fa(sessionAdminConfig));
});
