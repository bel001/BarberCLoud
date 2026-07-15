async function cargarEstado2fa(session) {
  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/estado`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    const data = await response.json();
    document.getElementById("estado2faDesactivado").classList.toggle("hidden", data.habilitado);
    document.getElementById("panelConfigurar2fa").classList.add("hidden");
    document.getElementById("estado2faActivado").classList.toggle("hidden", !data.habilitado);
  } catch (error) {
    Toast.show("Error al cargar el estado de 2FA: " + error.message, "error");
  }
}

async function iniciar2fa(session) {
  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/iniciar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` }
    });
    const data = await response.json();
    document.getElementById("secreto2fa").textContent = data.secret;
    document.getElementById("estado2faDesactivado").classList.add("hidden");
    document.getElementById("panelConfigurar2fa").classList.remove("hidden");
  } catch (error) {
    Toast.show("Error al iniciar 2FA: " + error.message, "error");
  }
}

async function confirmar2fa(session) {
  const codigo = document.getElementById("codigoConfirmar2fa").value;
  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ codigo })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    Toast.show(data.message, "success");
    await cargarEstado2fa(session);
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function desactivar2fa(session) {
  const codigo = document.getElementById("codigoDesactivar2fa").value;
  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/2fa/desactivar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ codigo })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    Toast.show(data.message, "success");
    await cargarEstado2fa(session);
  } catch (error) {
    Toast.show(error.message, "error");
  }
}
