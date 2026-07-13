const sessionClientesSecretaria = AUTH.requireSession();

let todosLosClientes = [];

function mostrarIdentidad() {
  const nombre = sessionClientesSecretaria.name || sessionClientesSecretaria.email || "Secretaria";
  document.getElementById("secretariaNombre").textContent = nombre;
  document.getElementById("secretariaAvatar").textContent = nombre.charAt(0).toUpperCase();
}

function renderClientes(lista) {
  const container = document.getElementById("listaClientes");

  container.innerHTML = lista.length
    ? lista.map(cliente => `
      <div class="list-item clickable-list-item" data-cliente-id="${escapeHtml(cliente.clienteId)}" data-cliente-nombre="${escapeHtml(cliente.nombre)}">
        <div class="list-item-info">
          <div class="list-item-title">${escapeHtml(cliente.nombre)}</div>
          <div class="list-item-subtitle">${escapeHtml(cliente.email)}${cliente.telefono ? " • " + escapeHtml(cliente.telefono) : ""}</div>
        </div>
      </div>
    `).join("")
    : `<p class="text-muted text-sm">No hay clientes que coincidan.</p>`;

  document.querySelectorAll("[data-cliente-id]").forEach(item => {
    item.addEventListener("click", () => cargarHistorial(item.dataset.clienteId, item.dataset.clienteNombre));
  });
}

async function cargarClientes() {
  try {
    const data = await API.get("/secretaria/clientes", sessionClientesSecretaria.token);
    todosLosClientes = data.clientes || [];
    renderClientes(todosLosClientes);
  } catch (error) {
    Toast.show("Error al cargar clientes: " + error.message, "error");
  }
}

async function cargarHistorial(clienteId, nombre) {
  document.getElementById("historialPlaceholder").classList.add("hidden");

  try {
    const data = await API.get(`/secretaria/clientes/${clienteId}/historial`, sessionClientesSecretaria.token);
    const reservas = data.reservas || [];

    document.getElementById("historialCliente").innerHTML = `
      <p class="text-muted mb-2"><strong>${escapeHtml(nombre)}</strong></p>
      ${reservas.length ? reservas.map(r => `
        <div class="list-item">
          <div class="list-item-info">
            <div class="list-item-title">${escapeHtml(r.servicioNombre || r.servicioId)} <span class="badge badge-info">${escapeHtml(r.estado)}</span></div>
            <div class="list-item-subtitle">📅 ${escapeHtml(r.fecha)} • ⏰ ${escapeHtml(r.hora)}</div>
          </div>
        </div>
      `).join("") : `<p class="text-muted text-sm">Sin reservas registradas.</p>`}
    `;
  } catch (error) {
    Toast.show("Error al cargar historial: " + error.message, "error");
  }
}

async function registrarClienteRapido(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const payload = {
      nombre: document.getElementById("nombreCliente").value,
      email: document.getElementById("emailCliente").value,
      telefono: document.getElementById("telefonoCliente").value || undefined
    };

    const response = await API.post("/secretaria/clientes", payload, sessionClientesSecretaria.token);
    Toast.show(response.message || "Cliente registrado", "success");
    document.getElementById("formClienteRapido").reset();
    await cargarClientes();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarClientes();
  document.getElementById("formClienteRapido").addEventListener("submit", registrarClienteRapido);
  document.getElementById("buscarCliente").addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    renderClientes(todosLosClientes.filter(c =>
      c.nombre?.toLowerCase().includes(query) || c.email?.toLowerCase().includes(query)
    ));
  });
});
