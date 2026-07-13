document.getElementById("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (BARBERCLOUD_CONFIG.AUTH_MODE === "cognito") {
    await AUTH.registerWithCognito();
    return;
  }

  const btn = document.getElementById("register-btn");
  const nombre = document.getElementById("nombreCliente").value;
  const email = document.getElementById("emailCliente").value;
  const password = document.getElementById("passwordCliente").value;

  Loading.button(btn, true);

  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo crear la cuenta");
    }

    AUTH.saveSession(data);
    Toast.show("Cuenta creada correctamente", "success");
    AUTH.redirectByRole(data.role);
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
});
