import client from 'prom-client';

export const registry = new client.Registry();

client.collectDefaultMetrics({
  register: registry,
  prefix: 'barbercloud_node_',
});

const httpRequestsTotal = new client.Counter({
  name: 'barbercloud_http_requests_total',
  help: 'Cantidad total de solicitudes HTTP procesadas por BarberCloud.',
  labelNames: ['method', 'route', 'status_class'],
  registers: [registry],
});

const httpRequestDuration = new client.Histogram({
  name: 'barbercloud_http_request_duration_seconds',
  help: 'Duración de solicitudes HTTP de BarberCloud en segundos.',
  labelNames: ['method', 'route', 'status_class'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const reservationsCreated = new client.Counter({
  name: 'barbercloud_reservas_creadas_total',
  help: 'Cantidad total de reservas creadas.',
  registers: [registry],
});

const reservationsCancelled = new client.Counter({
  name: 'barbercloud_reservas_canceladas_total',
  help: 'Cantidad total de reservas canceladas.',
  registers: [registry],
});

const reservationsRescheduled = new client.Counter({
  name: 'barbercloud_reservas_reprogramadas_total',
  help: 'Cantidad total de reservas reprogramadas.',
  registers: [registry],
});

const failedLogins = new client.Counter({
  name: 'barbercloud_login_fallidos_total',
  help: 'Cantidad total de inicios de sesión fallidos.',
  registers: [registry],
});

const salesCreated = new client.Counter({
  name: 'barbercloud_ventas_registradas_total',
  help: 'Cantidad total de ventas registradas.',
  registers: [registry],
});

const alertsReceived = new client.Counter({
  name: 'barbercloud_alertas_recibidas_total',
  help: 'Cantidad total de notificaciones recibidas desde Grafana.',
  labelNames: ['status'],
  registers: [registry],
});

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export const normalizeRoute = (originalUrl = '/') => {
  const pathname = originalUrl.split('?')[0] || '/';
  return pathname
    .replace(uuidPattern, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
};

export const classifyBusinessEvent = ({ method, route, statusCode }) => {
  const successful = statusCode >= 200 && statusCode < 400;

  if (method === 'POST' && successful && /\/appointments$/.test(route)) {
    return { event: 'reserva_creada', counter: reservationsCreated };
  }

  if (method === 'DELETE' && successful && /\/appointments\/:id$/.test(route)) {
    return { event: 'reserva_cancelada', counter: reservationsCancelled };
  }

  if (method === 'PUT' && successful && /\/appointments\/:id\/reschedule$/.test(route)) {
    return { event: 'reserva_reprogramada', counter: reservationsRescheduled };
  }

  if (method === 'POST' && successful && /\/pos\/sales$/.test(route)) {
    return { event: 'venta_registrada', counter: salesCreated };
  }

  if (method === 'POST' && route === '/api/auth/login' && statusCode >= 400) {
    return { event: 'login_fallido', counter: failedLogins };
  }

  return null;
};

export const writeStructuredLog = (payload) => {
  const log = {
    timestamp: new Date().toISOString(),
    service: 'backend',
    tier: 'application',
    ...payload,
  };
  const output = JSON.stringify(log);

  if (log.level === 'error') {
    console.error(output);
  } else if (log.level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
};

export const httpMetricsMiddleware = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const route = normalizeRoute(req.originalUrl);
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_class: statusClass,
    });

    httpRequestDuration.observe({
      method: req.method,
      route,
      status_class: statusClass,
    }, durationSeconds);

    if (route !== '/metrics') {
      writeStructuredLog({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        event: 'http_request',
        method: req.method,
        route,
        status: res.statusCode,
        status_class: statusClass,
        duration_ms: Math.round(durationSeconds * 1000),
        role: req.user?.role || 'PUBLIC',
      });
    }

    const businessEvent = classifyBusinessEvent({
      method: req.method,
      route,
      statusCode: res.statusCode,
    });

    if (businessEvent) {
      businessEvent.counter.inc();
      writeStructuredLog({
        level: businessEvent.event === 'login_fallido' ? 'warn' : 'info',
        event: businessEvent.event,
        method: req.method,
        route,
        status: res.statusCode,
        role: req.user?.role || 'PUBLIC',
      });
    }
  });

  next();
};

export const handleGrafanaWebhook = (req, res) => {
  const expectedToken = process.env.GRAFANA_WEBHOOK_TOKEN;
  const authorization = req.get('authorization') || '';

  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
    writeStructuredLog({
      level: 'warn',
      event: 'grafana_webhook_rechazado',
      status: 401,
    });
    return res.status(401).json({ ok: false, message: 'Webhook no autorizado' });
  }

  const status = String(req.body?.status || 'unknown').toLowerCase();
  const alertNames = Array.isArray(req.body?.alerts)
    ? req.body.alerts
      .map((alert) => alert?.labels?.alertname || alert?.labels?.rulename)
      .filter(Boolean)
      .slice(0, 10)
    : [];

  alertsReceived.inc({ status });
  writeStructuredLog({
    level: status === 'firing' ? 'warn' : 'info',
    event: 'grafana_alert',
    alert_status: status,
    alert_count: alertNames.length,
    alert_names: alertNames,
  });

  return res.status(202).json({ ok: true, received: alertNames.length });
};
