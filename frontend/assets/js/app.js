import { runtimeConfig } from './config.js';

export { runtimeConfig };

export const storage = {
  get session() {
    try { return JSON.parse(localStorage.getItem('barbercloud_session') || 'null'); } catch { return null; }
  },
  set session(value) {
    if (value) localStorage.setItem('barbercloud_session', JSON.stringify(value));
    else localStorage.removeItem('barbercloud_session');
  }
};

function apiEndpoint(path, method = 'GET') {
  if (path.startsWith('/public/')) return runtimeConfig.api.public;
  if (path.startsWith('/client/')) {
    if (method === 'DELETE' && path.startsWith('/client/appointments/')) return runtimeConfig.api.cancellation;
    return runtimeConfig.api.reservation;
  }
  if (path.startsWith('/barber/')) return runtimeConfig.api.barber;
  if (path.startsWith('/secretary/')) return runtimeConfig.api.secretary;
  if (path.startsWith('/admin/')) return runtimeConfig.api.admin;
  return runtimeConfig.api.public;
}

export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (storage.session?.token) headers.authorization = `Bearer ${storage.session.token}`;
  const endpoint = apiEndpoint(path, method);
  const response = await fetch(`${endpoint}/api${path}`, {
    ...options,
    method,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json().catch(() => ({ ok: false, message: 'Respuesta inválida del servidor' }));
  if (!response.ok || payload.ok === false) {
    if (response.status === 401 && !path.startsWith('/auth/')) logout(false);
    throw new Error(payload.message || 'No se pudo completar la operación');
  }
  return payload.data;
}

export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
  } catch {
    return {};
  }
}

export function cognitoRole(claims) {
  const groups = claims['cognito:groups'] || [];
  const normalized = Array.isArray(groups) ? groups : String(groups).split(',');
  return ['ADMIN', 'SECRETARIA', 'BARBERO', 'CLIENTE'].find((role) => normalized.includes(role)) || 'CLIENTE';
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

export function badge(status) {
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(String(status || '').replaceAll('_', ' '))}</span>`;
}

export function toast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3500);
}


function dialogId(prefix = 'dialog') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDialogFrame({ eyebrow = 'BarberCloud', title, description = '', icon = '✦', tone = 'primary' }) {
  const dialog = document.createElement('dialog');
  const titleId = dialogId('dialog-title');
  const descriptionId = dialogId('dialog-description');
  dialog.className = `bc-dialog bc-dialog-${tone}`;
  dialog.setAttribute('aria-labelledby', titleId);
  if (description) dialog.setAttribute('aria-describedby', descriptionId);
  dialog.innerHTML = `
    <div class="bc-dialog-panel">
      <div class="bc-dialog-header">
        <span class="bc-dialog-icon" aria-hidden="true">${escapeHtml(icon)}</span>
        <div>
          <span class="bc-dialog-eyebrow">${escapeHtml(eyebrow)}</span>
          <h2 id="${titleId}">${escapeHtml(title)}</h2>
          ${description ? `<p id="${descriptionId}">${escapeHtml(description)}</p>` : ''}
        </div>
      </div>
      <div class="bc-dialog-body"></div>
    </div>`;
  document.body.appendChild(dialog);
  return dialog;
}

function removeDialog(dialog) {
  if (!dialog) return;
  if (dialog.open) dialog.close();
  dialog.remove();
}

export function confirmDialog({
  eyebrow = 'Confirmación',
  title = '¿Deseas continuar?',
  description = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  icon = '!',
  tone = 'danger'
} = {}) {
  return new Promise((resolve) => {
    const dialog = createDialogFrame({ eyebrow, title, description, icon, tone });
    const body = dialog.querySelector('.bc-dialog-body');
    body.innerHTML = `
      <div class="bc-dialog-actions">
        <button class="btn btn-outline" type="button" data-dialog-cancel>${escapeHtml(cancelText)}</button>
        <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" type="button" data-dialog-confirm>${escapeHtml(confirmText)}</button>
      </div>`;

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      removeDialog(dialog);
      resolve(value);
    };

    dialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => finish(false));
    dialog.querySelector('[data-dialog-confirm]').addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false);
    });
    dialog.showModal();
    dialog.querySelector('[data-dialog-confirm]').focus();
  });
}

export function formDialog({
  eyebrow = 'BarberCloud',
  title = 'Completa la información',
  description = '',
  fields = [],
  confirmText = 'Guardar cambios',
  cancelText = 'Cancelar',
  icon = '✦',
  tone = 'primary'
} = {}) {
  return new Promise((resolve) => {
    const dialog = createDialogFrame({ eyebrow, title, description, icon, tone });
    const body = dialog.querySelector('.bc-dialog-body');
    const form = document.createElement('form');
    form.className = 'bc-dialog-form';
    form.noValidate = false;

    const fieldsMarkup = fields.map((field, index) => {
      const id = dialogId(`dialog-field-${index}`);
      const name = escapeHtml(field.name || `field${index}`);
      const label = escapeHtml(field.label || 'Valor');
      const helper = field.helper ? `<small class="bc-dialog-helper">${escapeHtml(field.helper)}</small>` : '';
      const required = field.required === false ? '' : 'required';
      const autofocus = index === 0 ? 'autofocus' : '';
      const common = `id="${id}" name="${name}" class="input" ${required} ${autofocus}`;
      let control = '';

      if (field.type === 'select') {
        const options = (field.options || []).map((option) => {
          const value = typeof option === 'object' ? option.value : option;
          const optionLabel = typeof option === 'object' ? option.label : option;
          const selected = String(value) === String(field.value ?? '') ? 'selected' : '';
          return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(optionLabel)}</option>`;
        }).join('');
        control = `<select ${common}>${options}</select>`;
      } else {
        const type = escapeHtml(field.type || 'text');
        const value = escapeHtml(field.value ?? '');
        const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : '';
        const min = field.min !== undefined ? `min="${escapeHtml(field.min)}"` : '';
        const max = field.max !== undefined ? `max="${escapeHtml(field.max)}"` : '';
        const step = field.step !== undefined ? `step="${escapeHtml(field.step)}"` : '';
        const inputMode = field.inputMode ? `inputmode="${escapeHtml(field.inputMode)}"` : '';
        control = `<input type="${type}" value="${value}" ${placeholder} ${min} ${max} ${step} ${inputMode} ${common}>`;
      }

      return `<label class="bc-dialog-field" for="${id}"><span>${label}</span>${control}${helper}</label>`;
    }).join('');

    form.innerHTML = `
      <div class="bc-dialog-fields">${fieldsMarkup}</div>
      <div class="bc-dialog-actions">
        <button class="btn btn-outline" type="button" data-dialog-cancel>${escapeHtml(cancelText)}</button>
        <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" type="submit">${escapeHtml(confirmText)}</button>
      </div>`;
    body.appendChild(form);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      removeDialog(dialog);
      resolve(value);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      finish(Object.fromEntries(new FormData(form).entries()));
    });
    form.querySelector('[data-dialog-cancel]').addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(null);
    });
    dialog.showModal();
  });
}

export function setLoading(element, state) {
  if (!element) return;
  element.classList.toggle('loading', state);
  if ('disabled' in element) element.disabled = state;
}

export function logout(redirect = true) {
  storage.session = null;
  if (!redirect) return;
  if (runtimeConfig.mode === 'aws' && runtimeConfig.cognito.domain) {
    const params = new URLSearchParams({
      client_id: runtimeConfig.cognito.clientId,
      logout_uri: runtimeConfig.cognito.logoutUri
    });
    window.location.href = `${runtimeConfig.cognito.domain}/logout?${params}`;
    return;
  }
  window.location.href = 'login.html';
}

export function requireAuth(roles = []) {
  const session = storage.session;
  if (!session?.token || !session?.user) {
    window.location.href = `login.html?next=${encodeURIComponent(location.pathname.split('/').pop() || 'cliente.html')}`;
    return null;
  }
  if (roles.length && !roles.includes(session.user.role)) {
    window.location.href = dashboardFor(session.user.role);
    return null;
  }
  return session;
}

export function dashboardFor(role) {
  return ({ CLIENTE: 'cliente.html', BARBERO: 'barbero-dashboard.html', SECRETARIA: 'secretaria.html', ADMIN: 'admin.html' })[role] || 'index.html';
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function enhanceNavigation(session) {
  document.body.dataset.role = session?.user?.role || 'GUEST';

  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .sidebar a').forEach((link) => {
    const target = (link.getAttribute('href') || '').split('?')[0];
    if (target === currentPage) link.classList.add('active');
  });

  const navbarInner = document.querySelector('.navbar-inner');
  const navLinks = document.querySelector('.nav-links');
  if (navbarInner && navLinks && !navbarInner.querySelector('.mobile-nav-toggle')) {
    const toggle = document.createElement('button');
    toggle.className = 'mobile-nav-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Abrir menú de navegación');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true"></span>';
    navbarInner.insertBefore(toggle, navLinks);
    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
    });
    navLinks.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const sidebar = document.querySelector('.sidebar');
  if (sidebar && !sidebar.querySelector('.sidebar-context')) {
    const context = document.createElement('div');
    context.className = 'sidebar-context';
    const roleLabel = ({ CLIENTE: 'Área del cliente', BARBERO: 'Área del barbero', SECRETARIA: 'Operación de recepción', ADMIN: 'Administración del negocio' })[session?.user?.role] || 'BarberCloud';
    context.innerHTML = `<strong>${escapeHtml(roleLabel)}</strong><span>${escapeHtml(session?.user?.name || 'Navegación principal')}</span>`;
    sidebar.prepend(context);
  }

  const enhanceTables = (scope = document) => {
    scope.querySelectorAll?.('table').forEach((table) => {
      const headers = [...table.querySelectorAll('thead th')].map((item) => item.textContent.trim());
      table.querySelectorAll('tbody tr').forEach((row) => {
        [...row.children].forEach((cell, index) => {
          if (headers[index]) cell.dataset.label = headers[index];
        });
      });
    });
  };
  enhanceTables();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) enhanceTables(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function mountNav() {
  const session = storage.session;
  document.querySelectorAll('[data-user-name]').forEach((element) => { element.textContent = session?.user?.name || 'Invitado'; });
  document.querySelectorAll('[data-user-role]').forEach((element) => { element.textContent = session?.user?.role || ''; });
  document.querySelectorAll('[data-auth-only]').forEach((element) => element.classList.toggle('hidden', !session));
  document.querySelectorAll('[data-guest-only]').forEach((element) => element.classList.toggle('hidden', Boolean(session)));
  document.querySelectorAll('[data-dashboard-link]').forEach((element) => { element.href = dashboardFor(session?.user?.role); });
  document.querySelectorAll('[data-logout]').forEach((element) => element.addEventListener('click', () => logout()));
  enhanceNavigation(session);
}

document.addEventListener('DOMContentLoaded', mountNav);
