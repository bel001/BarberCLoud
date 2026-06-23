const API = {
  async get(path, token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}${path}`, { headers });
    return response.json();
  },

  async post(path, payload, token = null) {
    const headers = {
      "Content-Type": "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${BARBERCLOUD_CONFIG.API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    return response.json();
  }
};
