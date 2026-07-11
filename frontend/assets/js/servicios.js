async function cargarServiciosYPrecios() {
  const grid = document.getElementById("serviciosPrecioGrid");

  try {
    const data = await API.get("/disponibilidad");
    const servicios = data.servicios || [];

    if (!servicios.length) {
      grid.innerHTML = `<p class="text-muted">No hay servicios disponibles por el momento.</p>`;
      return;
    }

    grid.innerHTML = servicios.map(servicio => `
      <div class="price-card">
        <div class="price-card-head">
          <h3>${escapeHtml(servicio.nombre)}</h3>
          <span class="price-tag">S/ ${escapeHtml(servicio.precio)}</span>
        </div>
        <p class="price-card-duration">${escapeHtml(servicio.duracionMinutos || 45)} min</p>
        <a href="reservar.html" class="btn btn-primary price-card-cta">Reservar</a>
      </div>
    `).join("");
  } catch (error) {
    grid.innerHTML = `<p class="text-muted">No se pudieron cargar los servicios. Intenta nuevamente más tarde.</p>`;
    Toast.show("Error al cargar servicios: " + error.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", cargarServiciosYPrecios);
