const sessionPersonalAdmin = AUTH.requireSession();

function mostrarIdentidad() {
  const nombre = sessionPersonalAdmin.name || sessionPersonalAdmin.email || "Administrador";
  document.getElementById("adminNombre").textContent = nombre;
  document.getElementById("adminAvatar").textContent = nombre.charAt(0).toUpperCase();
}

function rolLabel(rol) {
  const labels = { BARBERO: "Barbero", SECRETARIA: "Secretaria", ADMIN: "Administrador" };
  return labels[rol] || rol;
}

async function cargarPersonal() {
  const container = document.getElementById("listaPersonal");

  try {
    const data = await API.get("/admin/personal", sessionPersonalAdmin.token);
    const personal = data.personal || [];

    if (personal.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm">No hay personal registrado.</p>`;
      return;
    }

    container.innerHTML = personal.map(persona => `
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-title">
            ${escapeHtml(persona.nombre)}
            <span class="badge badge-info">${escapeHtml(rolLabel(persona.rol))}</span>
            <span class="badge badge-${persona.estado === "INACTIVO" ? "danger" : "success"}">${escapeHtml(persona.estado || "ACTIVO")}</span>
          </div>
          <div class="list-item-subtitle">${escapeHtml(persona.email)} ${persona.horario ? "• " + escapeHtml(persona.horario) : ""}</div>
        </div>
        ${persona.estado !== "INACTIVO" ? `
          <div class="list-item-actions">
            <button class="btn btn-danger-outline btn-sm" type="button" data-baja-userid="${escapeHtml(persona.userId)}" data-baja-rol="${escapeHtml(persona.rol)}">Dar de baja</button>
          </div>
        ` : ""}
      </div>
    `).join("");

    document.querySelectorAll("[data-baja-userid]").forEach(btn => {
      btn.addEventListener("click", () => darDeBaja(btn.dataset.bajaUserid, btn.dataset.bajaRol));
    });
  } catch (error) {
    container.innerHTML = `<div class="alert alert-error">Error al cargar personal: ${escapeHtml(error.message)}</div>`;
  }
}

async function darDeBaja(userId, rol) {
  if (!confirm("¿Dar de baja a este usuario? Perderá acceso al sistema.")) return;

  try {
    const response = await API.post(`/admin/personal/${userId}/baja`, { userId, rol }, sessionPersonalAdmin.token);
    Toast.show(response.message || "Usuario dado de baja", "success");
    await cargarPersonal();
  } catch (error) {
    Toast.show(error.message, "error");
  }
}

async function crearPersonal(event) {
  event.preventDefault();
  const btn = event.submitter;
  Loading.button(btn, true);

  try {
    const response = await API.post("/admin/personal", {
      nombre: document.getElementById("nombrePersonal").value,
      email: document.getElementById("emailPersonal").value,
      rol: document.getElementById("rolPersonal").value,
      horario: document.getElementById("horarioPersonal").value,
      password: document.getElementById("passwordPersonal").value
    }, sessionPersonalAdmin.token);

    Toast.show("Usuario creado: " + response.email, "success");
    document.getElementById("formPersonal").reset();
    await cargarPersonal();
  } catch (error) {
    Toast.show(error.message, "error");
  } finally {
    Loading.button(btn, false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarIdentidad();
  cargarPersonal();
  document.getElementById("formPersonal").addEventListener("submit", crearPersonal);
});
