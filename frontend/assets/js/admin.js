const sessionAdmin = AUTH.requireSession();

async function cargarReporte() {
  const data = await API.get("/admin/reporte-financiero", sessionAdmin.token);

  document.getElementById("reporte").innerHTML = `
    <div class="row-item">Total reservas: ${data.totalReservas || 0}</div>
    <div class="row-item">Reservas online: ${data.online || 0}</div>
    <div class="row-item">Reservas presenciales: ${data.presenciales || 0}</div>
  `;
}

document.addEventListener("DOMContentLoaded", cargarReporte);
