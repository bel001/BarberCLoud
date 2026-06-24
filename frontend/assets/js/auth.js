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
  },

  loginWithCognito() {
    const params = new URLSearchParams({
      client_id: BARBERCLOUD_CONFIG.COGNITO_CLIENT_ID,
      response_type: "code",
      scope: "email openid profile",
      redirect_uri: BARBERCLOUD_CONFIG.REDIRECT_URI
    });

    window.location.href = `${BARBERCLOUD_CONFIG.COGNITO_DOMAIN}/login?${params.toString()}`;
  },

  registerWithCognito() {
    const params = new URLSearchParams({
      client_id: BARBERCLOUD_CONFIG.COGNITO_CLIENT_ID,
      response_type: "code",
      scope: "email openid profile",
      redirect_uri: BARBERCLOUD_CONFIG.REDIRECT_URI
    });

    window.location.href = `${BARBERCLOUD_CONFIG.COGNITO_DOMAIN}/signup?${params.toString()}`;
  },

  decodeJwt(token) {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(decoded.split("").map(char =>
      `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`
    ).join("")));
  },

  async handleCognitoCallback() {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      document.getElementById("resultado").innerText = "No se recibio codigo de autenticacion.";
      return;
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: BARBERCLOUD_CONFIG.COGNITO_CLIENT_ID,
      code,
      redirect_uri: BARBERCLOUD_CONFIG.REDIRECT_URI
    });

    const response = await fetch(`${BARBERCLOUD_CONFIG.COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const tokens = await response.json();

    if (!response.ok) {
      document.getElementById("resultado").innerText = tokens.error_description || "No se pudo completar el login.";
      return;
    }

    const claims = this.decodeJwt(tokens.id_token);
    const groups = claims["cognito:groups"] || ["CLIENTE"];
    const role = Array.isArray(groups) ? groups[0] : String(groups).split(",")[0];

    this.saveSession({
      token: tokens.id_token,
      accessToken: tokens.access_token,
      role,
      email: claims.email,
      name: claims.name || claims.email
    });

    this.redirectByRole(role);
  }
};

async function iniciarSesion(event) {
  event.preventDefault();

  if (BARBERCLOUD_CONFIG.AUTH_MODE === "cognito") {
    AUTH.loginWithCognito();
    return;
  }

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
