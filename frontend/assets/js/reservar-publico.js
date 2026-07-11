const wizard = {
  step: 1,
  servicios: [],
  barberos: [],
  disponibilidadPorBarbero: {},
  seleccion: { servicioId: null, barberoId: null, fecha: null, hora: null }
};

function actualizarNavSegunSesion() {
  const session = AUTH.getSession();
  const estaLogueado = Boolean(session);

  document.getElementById("navGuest").classList.toggle("hidden", estaLogueado);
  document.getElementById("navUser").classList.toggle("hidden", !estaLogueado);
  document.getElementById("promoLogin").classList.toggle("hidden", estaLogueado);
  document.getElementById("loginNotice").classList.toggle("hidden", estaLogueado);

  if (estaLogueado) {
    const rutasPorRol = { CLIENTE: "cliente.html", SECRETARIA: "secretaria.html", BARBERO: "barbero.html", ADMIN: "admin.html" };
    document.getElementById("miPanel").href = rutasPorRol[session.role] || "index.html";
  }
}

function esHoraPasada(fecha, hora) {
  // Misma referencia UTC que usa el backend (assertReservaNoEsPasada) para
  // que una hora visible en el select nunca sea rechazada al confirmar.
  const fechaHora = new Date(`${fecha}T${hora}:00Z`);
  return fechaHora.getTime() <= Date.now();
}

function irAPaso(n) {
  wizard.step = n;

  document.querySelectorAll(".wizard-step").forEach(el => {
    el.classList.toggle("hidden", Number(el.dataset.step) !== n);
  });

  document.querySelectorAll(".wizard-progress-step").forEach(el => {
    const stepNum = Number(el.dataset.step);
    el.classList.toggle("active", stepNum === n);
    el.classList.toggle("done", stepNum < n);
  });

  const nav = document.getElementById("wizardNav");
  nav.classList.toggle("hidden", n >= 4);
  document.getElementById("btnAtras").classList.toggle("hidden", n === 1);

  if (n === 4) {
    renderResumen();
  }
}

function renderServicios() {
  document.getElementById("serviciosGrid").innerHTML = wizard.servicios.map(servicio => `
    <div class="option-card${wizard.seleccion.servicioId === servicio.id ? " selected" : ""}" data-servicio-id="${escapeHtml(servicio.id)}">
      <div class="option-card-title">${escapeHtml(servicio.nombre)}</div>
      <div class="option-card-subtitle">S/ ${escapeHtml(servicio.precio)} · ${escapeHtml(servicio.duracionMinutos || 45)} min</div>
    </div>
  `).join("");

  document.querySelectorAll("[data-servicio-id]").forEach(card => {
    card.addEventListener("click", () => {
      wizard.seleccion.servicioId = card.dataset.servicioId;
      renderServicios();
    });
  });
}

function renderBarberos() {
  document.getElementById("barberosGrid").innerHTML = wizard.barberos.map(barbero => `
    <div class="option-card${wizard.seleccion.barberoId === barbero.id ? " selected" : ""}" data-barbero-id="${escapeHtml(barbero.id)}">
      <div class="option-card-title">${escapeHtml(barbero.nombre)}</div>
    </div>
  `).join("");

  document.querySelectorAll("[data-barbero-id]").forEach(card => {
    card.addEventListener("click", () => {
      wizard.seleccion.barberoId = card.dataset.barberoId;
      wizard.seleccion.hora = null;
      renderBarberos();
      renderHoras();
    });
  });
}

function renderHoras() {
  const fecha = document.getElementById("fecha").value;
  const horarios = wizard.disponibilidadPorBarbero[wizard.seleccion.barberoId] || [];
  const disponibles = horarios.filter(hora => !esHoraPasada(fecha, hora));

  const grid = document.getElementById("horasGrid");

  if (!wizard.seleccion.barberoId) {
    grid.innerHTML = `<p class="text-muted text-sm">Elige un barbero para ver sus horarios.</p>`;
    return;
  }

  if (disponibles.length === 0) {
    grid.innerHTML = `<p class="text-muted text-sm">No hay horarios disponibles para esta fecha.</p>`;
    return;
  }

  grid.innerHTML = disponibles.map(hora => `
    <div class="option-card${wizard.seleccion.hora === hora ? " selected" : ""}" data-hora="${escapeHtml(hora)}">
      <div class="option-card-title">${escapeHtml(formatHora12h(hora))}</div>
    </div>
  `).join("");

  document.querySelectorAll("[data-hora]").forEach(card => {
    card.addEventListener("click", () => {
      wizard.seleccion.hora = card.dataset.hora;
      renderHoras();
    });
  });
}

async function cargarDisponibilidadParaFecha(fecha) {
  try {
    const data = await API.get(`/disponibilidad?fecha=${encodeURIComponent(fecha)}`);
    wizard.disponibilidadPorBarbero = data.disponibilidad || {};
    renderHoras();
  } catch (error) {
    Toast.show("Error al cargar disponibilidad: " + error.message, "error");
  }
}

async function cargarDisponibilidadPublica() {
  try {
    const data = await API.get("/disponibilidad");

    wizard.servicios = data.servicios;
    wizard.barberos = data.barberos;
    wizard.disponibilidadPorBarbero = data.disponibilidad || {};

    renderServicios();
    renderBarberos();

    const fechaEl = document.getElementById("fecha");
    fechaEl.valueAsDate = new Date();
    fechaEl.min = new Date().toISOString().slice(0, 10);

    renderHoras();
  } catch (error) {
    Toast.show("Error al cargar disponibilidad: " + error.message, "error");
  }
}

function renderResumen() {
  const servicio = wizard.servicios.find(s => s.id === wizard.seleccion.servicioId);
  const barbero = wizard.barberos.find(b => b.id === wizard.seleccion.barberoId);
  const fecha = document.getElementById("fecha").value;

  document.getElementById("resumenReserva").innerHTML = `
    <div class="list-item"><div class="list-item-info"><div class="list-item-title">Servicio</div><div class="list-item-subtitle">${escapeHtml(servicio?.nombre || "-")} · S/ ${escapeHtml(servicio?.precio ?? "-")}</div></div></div>
    <div class="list-item"><div class="list-item-info"><div class="list-item-title">Barbero</div><div class="list-item-subtitle">${escapeHtml(barbero?.nombre || "-")}</div></div></div>
    <div class="list-item"><div class="list-item-info"><div class="list-item-title">Fecha y hora</div><div class="list-item-subtitle">${escapeHtml(fecha)} · ${escapeHtml(formatHora12h(wizard.seleccion.hora || "00:00"))}</div></div></div>
  `;
}

function validarPaso(n) {
  if (n === 1 && !wizard.seleccion.servicioId) {
    Toast.show("Elige un servicio para continuar", "warning");
    return false;
  }
  if (n === 2 && !wizard.seleccion.barberoId) {
    Toast.show("Elige un barbero para continuar", "warning");
    return false;
  }
  if (n === 3 && !wizard.seleccion.hora) {
    Toast.show("Elige una hora para continuar", "warning");
    return false;
  }
  return true;
}

async function confirmarReserva() {
  const btn = document.getElementById("btnConfirmar");
  Loading.button(btn, true);

  try {
    const reservaPendiente = {
      servicioId: wizard.seleccion.servicioId,
      barberoId: wizard.seleccion.barberoId,
      fecha: document.getElementById("fecha").value,
      hora: wizard.seleccion.hora
    };

    localStorage.setItem("reserva_pendiente", JSON.stringify(reservaPendiente));

    const session = AUTH.getSession();

    if (!session) {
      Toast.show("Redirigiendo al login...", "info");
      window.location.href = "login.html";
      return;
    }

    if (session.role !== "CLIENTE") {
      Toast.show("Solo una cuenta de cliente puede confirmar reservas online", "warning");
      return;
    }

    const response = await API.post("/reservas", reservaPendiente, session.token);

    if (response.reservaId) {
      localStorage.removeItem("reserva_pendiente");
      document.getElementById("reservaIdResultado").textContent = response.reservaId;
      document.getElementById("resumenFinal").innerHTML = document.getElementById("resumenReserva").innerHTML;
      irAPaso(5);
    } else {
      Toast.show(response.error || "Error al confirmar", "error");
    }
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  actualizarNavSegunSesion();
  cargarDisponibilidadPublica();
  irAPaso(1);

  document.getElementById("fecha").addEventListener("change", (event) => {
    wizard.seleccion.hora = null;
    cargarDisponibilidadParaFecha(event.target.value);
  });

  document.getElementById("btnSiguiente").addEventListener("click", () => {
    if (!validarPaso(wizard.step)) return;
    irAPaso(Math.min(wizard.step + 1, 4));
  });

  document.getElementById("btnAtras").addEventListener("click", () => {
    irAPaso(Math.max(wizard.step - 1, 1));
  });

  document.getElementById("btnConfirmar").addEventListener("click", confirmarReserva);
});
