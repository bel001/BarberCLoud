document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (BARBERCLOUD_CONFIG.AUTH_MODE === "cognito") {
    await AUTH.loginWithCognito();
    return;
  }

  const btn = document.getElementById("login-btn");
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const codigo2fa = document.getElementById("codigo2fa").value;

  Loading.button(btn, true);

  try {
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, codigo2fa: codigo2fa || undefined })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Credenciales inválidas");
    }

    if (data.requiere2fa) {
      document.getElementById("grupo2fa").classList.remove("hidden");
      document.getElementById("codigo2fa").focus();
      Toast.show("Ingresa el código de tu app de autenticación", "info");
      return;
    }

    AUTH.saveSession(data);
    Toast.show("Sesión iniciada correctamente", "success");
    AUTH.redirectByRole(data.role);
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
});
