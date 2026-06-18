const AUTH = {
  saveSession(session) {
    localStorage.setItem("barbercloud_session", JSON.stringify(session));
  },

  getSession() {
    const raw = localStorage.getItem("barbercloud_session");
    return raw ? JSON.parse(raw) : null;
  },

  logout() {
    localStorage.removeItem("barbercloud_session");
    window.location.href = "index.html";
  },

  requireSession() {
    const session = this.getSession();
    if (!session) {
      window.location.href = "login.html";
      return null;
    }
    return session;
  },

  redirectByRole(role) {
    const routes = {
      CLIENTE: "cliente.html",
      SECRETARIA: "secretaria.html",
      BARBERO: "barbero.html",
      ADMIN: "admin.html"
    };

    window.location.href = routes[role] || "index.html";
  }
};

async function iniciarSesion(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}/dev/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    document.getElementById("resultado").innerText = data.error || "No se pudo iniciar sesión";
    return;
  }

  AUTH.saveSession(data);

  const pendiente = localStorage.getItem("reserva_pendiente");
  if (pendiente && data.role === "CLIENTE") {
    window.location.href = "cliente.html";
    return;
  }

  AUTH.redirectByRole(data.role);
}
