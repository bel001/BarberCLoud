const API = {
  baseFor(path) {
    const urls = BARBERCLOUD_CONFIG.API_BASE_URLS || {};

    if (path.startsWith("/disponibilidad")) return urls.disponibilidad || BARBERCLOUD_CONFIG.API_BASE_URL;
    if (path.startsWith("/reservas/") && path.includes("/cancelar")) return urls.cancelar || BARBERCLOUD_CONFIG.API_BASE_URL;
    if (path.startsWith("/barbero")) return urls.barbero || BARBERCLOUD_CONFIG.API_BASE_URL;
    if (path.startsWith("/secretaria")) return urls.secretaria || BARBERCLOUD_CONFIG.API_BASE_URL;
    if (path.startsWith("/admin")) return urls.administrador || BARBERCLOUD_CONFIG.API_BASE_URL;

    return urls.reserva || BARBERCLOUD_CONFIG.API_BASE_URL;
  },

  async get(path, token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${this.baseFor(path)}${path}`, { headers });

    if (!response.ok) {
      const error = await response.text().catch(() => "Error de conexion");
      throw new Error(`GET ${path} failed: ${response.status} ${error}`);
    }

    return response.json();
  },

  async post(path, payload, token = null) {
    const headers = {
      "Content-Type": "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseFor(path)}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Error de conexion");
      throw new Error(`POST ${path} failed: ${response.status} ${error}`);
    }

    return response.json();
  }
};