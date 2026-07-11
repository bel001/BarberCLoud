const sessionNegocio = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = sessionNegocio.name || sessionNegocio.email || "Administrador";
  document.getElementById("adminNombre").textContent = nombre;
  document.getElementById("adminAvatar").textContent = nombre.charAt(0).toUpperCase();
}

async function cargarConfigNegocio() {
  try {
    const data = await API.get("/admin/config-negocio", sessionNegocio.token);
    const cfg = data.config || data;

    document.getElementById("comisionPorcentaje").value = cfg.comisionPorcentaje;
    document.getElementById("penalizacionPorcentaje").value = cfg.penalizacionPorcentaje;
    document.getElementById("horasParaPenalizacion").value = cfg.horasParaPenalizacion;
    document.getElementById("anticipacionMinimaHoras").value = cfg.anticipacionMinimaHoras;
    document.getElementById("anticipacionMaximaDias").value = cfg.anticipacionMaximaDias;
  } catch (error) {
    Toast.show("Error al cargar la configuración: " + error.message, "error");
  }
}

async function guardarConfigNegocio(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    await API.put("/admin/config-negocio", {
      comisionPorcentaje: Number(document.getElementById("comisionPorcentaje").value),
      penalizacionPorcentaje: Number(document.getElementById("penalizacionPorcentaje").value),
      horasParaPenalizacion: Number(document.getElementById("horasParaPenalizacion").value),
      anticipacionMinimaHoras: Number(document.getElementById("anticipacionMinimaHoras").value),
      anticipacionMaximaDias: Number(document.getElementById("anticipacionMaximaDias").value)
    }, sessionNegocio.token);

    Toast.show("Configuración del negocio actualizada", "success");
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

async function cargarServicios() {
  try {
    const data = await API.get("/admin/servicios", sessionNegocio.token);
    const servicios = data.servicios || [];
    const container = document.getElementById("servicios");

    if (servicios.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm">No hay servicios configurados</p>`;
      return;
    }

    container.innerHTML = servicios.map(item => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(item.nombre)}</div>
          <div class="list-item-subtitle">S/ ${escapeHtml(item.precio)} · ${escapeHtml(item.duracionMinutos || 45)} min</div>
        </div>
      </div>
    `).join("");
  } catch (error) {
    Toast.show("Error al cargar servicios: " + error.message, "error");
  }
}

async function guardarServicio(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    await API.post("/admin/servicios", {
      nombre: document.getElementById("nombreServicio").value,
      precio: Number(document.getElementById("precioServicio").value),
      duracionMinutos: Number(document.getElementById("duracionServicio").value)
    }, sessionNegocio.token);

    Toast.show("Servicio guardado correctamente", "success");
    document.getElementById("formServicio").reset();
    await cargarServicios();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarConfigNegocio();
  cargarServicios();
  document.getElementById("formConfigNegocio").addEventListener("submit", guardarConfigNegocio);
  document.getElementById("formServicio").addEventListener("submit", guardarServicio);
});
