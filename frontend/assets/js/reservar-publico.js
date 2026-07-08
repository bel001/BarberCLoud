async function cargarDisponibilidadPublica() {
  try {
    const data = await API.get("/disponibilidad");

    document.getElementById("servicioId").innerHTML = data.servicios
      .map(servicio => `<option value="${escapeHtml(servicio.id)}">${escapeHtml(servicio.nombre)} - S/ ${escapeHtml(servicio.precio)}</option>`)
      .join("");

    document.getElementById("barberoId").innerHTML = data.barberos
      .map(barbero => `<option value="${escapeHtml(barbero.id)}">${escapeHtml(barbero.nombre)}</option>`)
      .join("");

    document.getElementById("hora").innerHTML = data.horarios
      .map(hora => `<option value="${escapeHtml(hora)}">${escapeHtml(hora)}</option>`)
      .join("");

    const fechaEl = document.getElementById("fecha");
    if (fechaEl) {
      fechaEl.valueAsDate = new Date();
    }
  } catch (error) {
    Toast.show("Error al cargar disponibilidad: " + error.message, "error");
  }
}

function panelRouteFor(role) {
  const routes = {
    CLIENTE: "cliente.html",
    SECRETARIA: "secretaria.html",
    BARBERO: "barbero.html",
    ADMIN: "admin.html"
  };

  return routes[role] || "index.html";
}

function actualizarEstadoSesionReserva() {
  const session = AUTH.getSession();
  const sessionLink = document.getElementById("sessionLink");
  const loginPrompt = document.getElementById("loginPrompt");
  const reservaHint = document.getElementById("reservaHint");

  if (!session?.token || !session?.role) {
    if (loginPrompt) {
      loginPrompt.classList.remove("hidden");
    }
    return;
  }

  if (sessionLink) {
    sessionLink.href = panelRouteFor(session.role);
    sessionLink.textContent = session.role === "CLIENTE" ? "Mis reservas" : "Mi panel";
  }

  if (loginPrompt) {
    loginPrompt.classList.add("hidden");
  }

  if (reservaHint) {
    reservaHint.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
      ${session.role === "CLIENTE"
        ? "Tu sesión está activa. Al confirmar, la cita quedará registrada en tu cuenta."
        : "Tu sesión está activa, pero solo una cuenta de cliente puede confirmar reservas online."}
    `;
  }
}

async function confirmarReservaPublica(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const reservaPendiente = {
      servicioId: document.getElementById("servicioId").value,
      barberoId: document.getElementById("barberoId").value,
      fecha: document.getElementById("fecha").value,
      hora: document.getElementById("hora").value
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
      Toast.show("Reserva confirmada: " + response.reservaId, "success");
      document.getElementById("formReservaPublica").reset();
      await cargarDisponibilidadPublica();
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
  actualizarEstadoSesionReserva();
  cargarDisponibilidadPublica();
  document.getElementById("formReservaPublica").addEventListener("submit", confirmarReservaPublica);
});
