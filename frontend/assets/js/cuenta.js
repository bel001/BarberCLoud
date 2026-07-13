const sessionCuenta = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = sessionCuenta.name || sessionCuenta.email || "Cliente";
  document.getElementById("clienteNombre").textContent = nombre;
  document.getElementById("clienteAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarDatosCuenta() {
  try {
    const data = await API.get("/cliente/cuenta", sessionCuenta.token);
    document.getElementById("nombreCuenta").value = data.nombre || "";
    document.getElementById("emailCuenta").value = data.email || "";
  } catch (error) {
    Toast.show("Error al cargar tu cuenta: " + error.message, "error");
  }
}

async function guardarDatos(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const nombre = document.getElementById("nombreCuenta").value;
    const response = await API.put("/cliente/cuenta", { nombre }, sessionCuenta.token);

    const sesionActual = AUTH.getSession();
    AUTH.saveSession({ ...sesionActual, name: nombre });

    Toast.show(response.message || "Datos actualizados", "success");
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function cambiarPassword(event) {
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
        Authorization: `Bearer ${sessionCuenta.token}`
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

async function eliminarCuenta() {
  if (!confirm("¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.")) return;

  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/cuenta`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionCuenta.token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo eliminar la cuenta");
    }

    Toast.show(data.message || "Cuenta eliminada", "success");
    setTimeout(() => AUTH.logout(), 1000);
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarDatosCuenta();
  document.getElementById("formDatos").addEventListener("submit", guardarDatos);

  if (!AUTH.enableLocalAuthControls()) return;

  document.getElementById("formPassword").addEventListener("submit", cambiarPassword);
  document.getElementById("btnEliminarCuenta").addEventListener("click", eliminarCuenta);
});
