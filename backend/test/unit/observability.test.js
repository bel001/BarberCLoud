import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  classifyBusinessEvent,
  handleGrafanaWebhook,
  httpMetricsMiddleware,
  normalizeRoute,
  registry,
  writeStructuredLog,
} from '../../src/lib/observability.js';

const originalWebhookToken =
  process.env.GRAFANA_WEBHOOK_TOKEN;

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined,
  };

  response.status = vi.fn((statusCode) => {
    response.statusCode = statusCode;
    return response;
  });

  response.json = vi.fn((body) => {
    response.body = body;
    return response;
  });

  return response;
};

const executeMiddleware = ({
  method = 'GET',
  originalUrl = '/',
  statusCode = 200,
  role,
}) => {
  let finishCallback;

  const request = {
    method,
    originalUrl,
    user: role ? { role } : undefined,
  };

  const response = {
    statusCode,
    on: vi.fn((event, callback) => {
      expect(event).toBe('finish');
      finishCallback = callback;
    }),
  };

  const next = vi.fn();

  httpMetricsMiddleware(request, response, next);

  expect(next).toHaveBeenCalledOnce();
  expect(finishCallback).toBeTypeOf('function');

  finishCallback();

  return {
    request,
    response,
    next,
  };
};

afterEach(() => {
  vi.restoreAllMocks();

  if (originalWebhookToken === undefined) {
    delete process.env.GRAFANA_WEBHOOK_TOKEN;
  } else {
    process.env.GRAFANA_WEBHOOK_TOKEN =
      originalWebhookToken;
  }
});

describe('normalización de rutas', () => {
  it('normaliza identificadores numéricos y parámetros', () => {
    expect(
      normalizeRoute(
        '/api/client/appointments/123/reschedule?source=web',
      ),
    ).toBe(
      '/api/client/appointments/:id/reschedule',
    );
  });

  it('normaliza identificadores UUID', () => {
    expect(
      normalizeRoute(
        '/api/client/appointments/'
        + '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).toBe('/api/client/appointments/:id');
  });

  it('utiliza la raíz para una URL vacía o inexistente', () => {
    expect(normalizeRoute()).toBe('/');
    expect(normalizeRoute('')).toBe('/');
  });
});

describe('clasificación de eventos de negocio', () => {
  const cases = [
    {
      method: 'POST',
      route: '/api/client/appointments',
      statusCode: 201,
      event: 'reserva_creada',
    },
    {
      method: 'DELETE',
      route: '/api/client/appointments/:id',
      statusCode: 204,
      event: 'reserva_cancelada',
    },
    {
      method: 'PUT',
      route:
        '/api/client/appointments/:id/reschedule',
      statusCode: 200,
      event: 'reserva_reprogramada',
    },
    {
      method: 'POST',
      route: '/api/secretary/pos/sales',
      statusCode: 201,
      event: 'venta_registrada',
    },
    {
      method: 'POST',
      route: '/api/auth/login',
      statusCode: 401,
      event: 'login_fallido',
    },
  ];

  it.each(cases)(
    'clasifica $event',
    ({
      method,
      route,
      statusCode,
      event,
    }) => {
      expect(
        classifyBusinessEvent({
          method,
          route,
          statusCode,
        })?.event,
      ).toBe(event);
    },
  );

  it('ignora operaciones fallidas o no monitoreadas', () => {
    expect(
      classifyBusinessEvent({
        method: 'POST',
        route: '/api/client/appointments',
        statusCode: 400,
      }),
    ).toBeNull();

    expect(
      classifyBusinessEvent({
        method: 'GET',
        route: '/api/services',
        statusCode: 200,
      }),
    ).toBeNull();

    expect(
      classifyBusinessEvent({
        method: 'POST',
        route: '/api/auth/login',
        statusCode: 200,
      }),
    ).toBeNull();
  });
});

describe('logs estructurados', () => {
  it('genera logs info, warning y error en JSON', () => {
    const info = vi
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    writeStructuredLog({
      level: 'info',
      event: 'prueba_info',
    });

    writeStructuredLog({
      level: 'warn',
      event: 'prueba_warning',
    });

    writeStructuredLog({
      level: 'error',
      event: 'prueba_error',
    });

    expect(info).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();

    const parsed = JSON.parse(
      info.mock.calls[0][0],
    );

    expect(parsed).toMatchObject({
      service: 'backend',
      tier: 'application',
      level: 'info',
      event: 'prueba_info',
    });

    expect(parsed.timestamp).toBeTypeOf('string');
  });
});

describe('middleware de métricas HTTP', () => {
  it('registra solicitudes y eventos de negocio', async () => {
    const log = vi
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    executeMiddleware({
      method: 'POST',
      originalUrl:
        '/api/client/appointments?source=web',
      statusCode: 201,
      role: 'CLIENTE',
    });

    const events = log.mock.calls.map(
      ([entry]) => JSON.parse(entry).event,
    );

    expect(events).toContain('http_request');
    expect(events).toContain('reserva_creada');

    const metrics = await registry.metrics();

    expect(metrics).toContain(
      'barbercloud_http_requests_total',
    );

    expect(metrics).toContain(
      'barbercloud_reservas_creadas_total',
    );
  });

  it('clasifica respuestas 4xx y 5xx', () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    executeMiddleware({
      method: 'GET',
      originalUrl: '/api/no-encontrado',
      statusCode: 404,
    });

    executeMiddleware({
      method: 'GET',
      originalUrl: '/api/error',
      statusCode: 500,
    });

    executeMiddleware({
      method: 'POST',
      originalUrl: '/api/auth/login',
      statusCode: 401,
    });

    expect(warning.mock.calls.length)
      .toBeGreaterThanOrEqual(2);

    expect(error).toHaveBeenCalledOnce();
  });

  it('no escribe un log por cada scraping de métricas', () => {
    const log = vi
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    executeMiddleware({
      method: 'GET',
      originalUrl: '/metrics',
      statusCode: 200,
    });

    expect(log).not.toHaveBeenCalled();
    expect(warning).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('webhook de Grafana', () => {
  it('rechaza solicitudes cuando falta el token', () => {
    delete process.env.GRAFANA_WEBHOOK_TOKEN;

    vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const request = {
      get: vi.fn(() => ''),
      body: {},
    };

    const response = createResponse();

    handleGrafanaWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(401);

    expect(response.body).toEqual({
      ok: false,
      message: 'Webhook no autorizado',
    });
  });

  it('rechaza un token incorrecto', () => {
    process.env.GRAFANA_WEBHOOK_TOKEN =
      'token-correcto';

    vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const request = {
      get: vi.fn(
        () => 'Bearer token-incorrecto',
      ),
      body: {},
    };

    const response = createResponse();

    handleGrafanaWebhook(request, response);

    expect(response.statusCode).toBe(401);
  });

  it('acepta alertas firing autorizadas', () => {
    process.env.GRAFANA_WEBHOOK_TOKEN =
      'token-seguro';

    vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const request = {
      get: vi.fn(() => 'Bearer token-seguro'),
      body: {
        status: 'firing',
        alerts: [
          {
            labels: {
              alertname: 'CPU backend',
            },
          },
          {
            labels: {
              rulename: 'Backend caído',
            },
          },
          {},
        ],
      },
    };

    const response = createResponse();

    handleGrafanaWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(202);

    expect(response.body).toEqual({
      ok: true,
      received: 2,
    });
  });

  it('acepta una recuperación sin alertas', () => {
    process.env.GRAFANA_WEBHOOK_TOKEN =
      'token-seguro';

    vi
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    const request = {
      get: vi.fn(() => 'Bearer token-seguro'),
      body: {
        status: 'resolved',
      },
    };

    const response = createResponse();

    handleGrafanaWebhook(request, response);

    expect(response.statusCode).toBe(202);

    expect(response.body).toEqual({
      ok: true,
      received: 0,
    });
  });
});
