const AUTH = {
  oauthStorageKey: "barbercloud_oauth_transaction",

  saveSession(session) {
    localStorage.setItem("barbercloud_session", JSON.stringify(session));
  },

  getSession() {
    const raw = localStorage.getItem("barbercloud_session");
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);

      if (this.isTokenExpired(session.token)) {
        localStorage.removeItem("barbercloud_session");
        return null;
      }

      return session;
    } catch {
      localStorage.removeItem("barbercloud_session");
      return null;
    }
  },

  isTokenExpired(token) {
    if (!token || !token.includes(".")) return false;

    try {
      const claims = this.decodeJwt(token);
      if (!claims.exp) return false;

      return claims.exp * 1000 <= Date.now() + 30000;
    } catch {
      return true;
    }
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
      BARBERO: "barbero-dashboard.html",
      ADMIN: "admin.html"
    };

    window.location.href = routes[role] || "index.html";
  },

  redirectAfterLogin(session) {
    const pendiente = localStorage.getItem("reserva_pendiente");

    if (pendiente && session.role === "CLIENTE") {
      window.location.href = "cliente.html";
      return;
    }

    this.redirectByRole(session.role);
  },

  base64Url(bytes) {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },

  randomBase64Url(byteLength) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return this.base64Url(bytes);
  },

  async sha256Base64Url(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return this.base64Url(new Uint8Array(digest));
  },

  async startCognitoFlow(path) {
    const state = this.randomBase64Url(32);
    const verifier = this.randomBase64Url(64);
    const challenge = await this.sha256Base64Url(verifier);

    sessionStorage.setItem(this.oauthStorageKey, JSON.stringify({
      state,
      verifier,
      createdAt: Date.now()
    }));

    const params = new URLSearchParams({
      client_id: BARBERCLOUD_CONFIG.COGNITO_CLIENT_ID,
      response_type: "code",
      scope: "email openid profile",
      redirect_uri: BARBERCLOUD_CONFIG.REDIRECT_URI,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    window.location.href = `${BARBERCLOUD_CONFIG.COGNITO_DOMAIN}/${path}?${params.toString()}`;
  },

  loginWithCognito() {
    return this.startCognitoFlow("login");
  },

  registerWithCognito() {
    return this.startCognitoFlow("signup");
  },

  consumeOAuthTransaction(receivedState) {
    const raw = sessionStorage.getItem(this.oauthStorageKey);
    sessionStorage.removeItem(this.oauthStorageKey);

    if (!raw || !receivedState) {
      throw new Error("No se encontro una solicitud de autenticacion valida.");
    }

    const transaction = JSON.parse(raw);
    const expired = Date.now() - transaction.createdAt > 10 * 60 * 1000;

    if (expired || transaction.state !== receivedState || !transaction.verifier) {
      throw new Error("La solicitud de autenticacion no es valida o expiro.");
    }

    return transaction;
  },

  decodeJwt(token) {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(decodeURIComponent(decoded.split("").map(char =>
      `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`
    ).join("")));
  },

  async handleCognitoCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error_description") || params.get("error");

    if (oauthError) {
      sessionStorage.removeItem(this.oauthStorageKey);
      throw new Error(oauthError);
    }

    if (!code) {
      throw new Error("No se recibio codigo de autenticacion.");
    }

    const transaction = this.consumeOAuthTransaction(params.get("state"));

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: BARBERCLOUD_CONFIG.COGNITO_CLIENT_ID,
      code,
      redirect_uri: BARBERCLOUD_CONFIG.REDIRECT_URI,
      code_verifier: transaction.verifier
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
      throw new Error(tokens.error_description || "No se pudo completar el login.");
    }

    const claims = this.decodeJwt(tokens.id_token);
    const groups = claims["cognito:groups"] || ["CLIENTE"];
    const role = Array.isArray(groups) ? groups[0] : String(groups).split(",")[0];

    this.saveSession({
      token: tokens.id_token,
      accessToken: tokens.access_token,
      role,
      sub: claims.sub,
      email: claims.email,
      name: claims.name || claims.email
    });

    this.redirectAfterLogin({ role });
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

  AUTH.redirectAfterLogin(data);
}
