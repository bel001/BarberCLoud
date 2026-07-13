import { api, escapeHtml, formatMoney } from './app.js';

async function loadServices() {
  const target = document.querySelector('[data-services]');
  if (!target) return;

  try {
    const services = await api('/public/services');

    target.innerHTML = services.map((service, index) => `
      <article class="card service-card service-card--plain">
        <div class="service-body">
          <div class="service-topline">
            <span class="service-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="price">${formatMoney(service.price)}</span>
          </div>
          <div class="service-copy">
            <h3>${escapeHtml(service.name)}</h3>
            <p class="muted">${escapeHtml(service.description || 'Servicio profesional de barbería.')}</p>
          </div>
          <div class="service-footer">
            <p class="service-meta">${service.duration} min de atención</p>
            <a class="btn btn-primary" href="reservar.html?serviceId=${encodeURIComponent(service.id)}">Reservar este servicio</a>
          </div>
        </div>
      </article>
    `).join('');
  } catch (error) {
    target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

loadServices();
