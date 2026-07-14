import fs from 'node:fs/promises';

const parseEnv = (content) => Object.fromEntries(
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');

      if (separator < 1) {
        throw new Error(`Variable inválida: ${line}`);
      }

      return [
        line.slice(0, separator),
        line.slice(separator + 1),
      ];
    }),
);

const env = parseEnv(
  await fs.readFile('.env.monitoring', 'utf8'),
);

const grafanaPort = env.GRAFANA_PORT || '3000';
const prometheusPort = env.PROMETHEUS_PORT || '9090';
const grafanaUser =
  env.GRAFANA_ADMIN_USER || 'barbercloud';
const grafanaPassword = env.GRAFANA_ADMIN_PASSWORD;

if (!grafanaPassword) {
  throw new Error(
    'No existe GRAFANA_ADMIN_PASSWORD en .env.monitoring.',
  );
}

const authorization = `Basic ${Buffer.from(
  `${grafanaUser}:${grafanaPassword}`,
).toString('base64')}`;

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(
      `${url} devolvió HTTP ${response.status}`,
    );
  }

  return response.json();
};

const requestOk = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `${url} devolvió HTTP ${response.status}`,
    );
  }
};

await requestOk('http://127.0.0.1:8080');
await requestOk('http://127.0.0.1:3001/health');

const health = await requestJson(
  `http://127.0.0.1:${grafanaPort}/api/health`,
);

if (health.database !== 'ok') {
  throw new Error(
    `Grafana no está saludable: ${JSON.stringify(health)}`,
  );
}

const targets = await requestJson(
  `http://127.0.0.1:${prometheusPort}/api/v1/targets`,
);

const requiredJobs = new Set([
  'prometheus',
  'cadvisor',
  'node-exporter',
]);

const activeJobs = new Set(
  targets.data.activeTargets
    .filter((target) => target.health === 'up')
    .map((target) => target.labels.job),
);

for (const job of requiredJobs) {
  if (!activeJobs.has(job)) {
    throw new Error(
      `Target Prometheus no disponible: ${job}`,
    );
  }
}

const headers = {
  authorization,
};

const dashboards = await requestJson(
  `http://127.0.0.1:${grafanaPort}/api/search?query=BarberCloud`,
  {
    headers,
  },
);

const dashboardEncontrado = dashboards.some(
  (item) =>
    item.type === 'dash-db'
    && item.title?.toLowerCase().includes('barbercloud'),
);

if (!dashboardEncontrado) {
  throw new Error(
    'El dashboard BarberCloud no fue aprovisionado.',
  );
}

const alerts = await requestJson(
  `http://127.0.0.1:${grafanaPort}/api/v1/provisioning/alert-rules`,
  {
    headers,
  },
);

const alertsText = JSON.stringify(alerts).toLowerCase();

if (
  !alertsText.includes('cpu')
  || !alertsText.includes('50')
) {
  throw new Error(
    'La alerta de CPU del backend no fue aprovisionada.',
  );
}

console.log('✓ Frontend y backend disponibles');
console.log('✓ Grafana saludable');
console.log('✓ Prometheus disponible');
console.log('✓ cAdvisor disponible');
console.log('✓ Node Exporter disponible');
console.log('✓ Dashboard BarberCloud aprovisionado');
console.log('✓ Alerta de CPU aprovisionada');
