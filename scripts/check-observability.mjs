import fs from 'node:fs/promises';

const parseEnv = (content) => Object.fromEntries(
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      if (separator < 1) throw new Error(`Variable inválida: ${line}`);
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const env = parseEnv(await fs.readFile('.env.monitoring', 'utf8'));
const authorization = `Basic ${Buffer.from(
  `${env.GRAFANA_ADMIN_USER}:${env.GRAFANA_ADMIN_PASSWORD}`,
).toString('base64')}`;

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} devolvió HTTP ${response.status}`);
  return response;
};

const requestJson = async (url, options = {}) => (await request(url, options)).json();

await request('http://127.0.0.1:8080');
await request('http://127.0.0.1:3001/health');
await request('http://127.0.0.1:3001/metrics');
await request('http://127.0.0.1:3100/ready');
await request('http://127.0.0.1:12345/metrics');

const grafanaHealth = await requestJson('http://127.0.0.1:3000/api/health');
if (grafanaHealth.database !== 'ok') throw new Error('Grafana no está saludable.');

const targets = await requestJson('http://127.0.0.1:9090/api/v1/targets');
const requiredJobs = new Set([
  'prometheus',
  'cadvisor',
  'node-exporter',
  'barbercloud-backend',
]);
const activeJobs = new Set(
  targets.data.activeTargets
    .filter((target) => target.health === 'up')
    .map((target) => target.labels.job),
);
for (const job of requiredJobs) {
  if (!activeJobs.has(job)) throw new Error(`Target Prometheus no disponible: ${job}`);
}

const headers = { authorization };
const datasources = await requestJson('http://127.0.0.1:3000/api/datasources', { headers });
for (const uid of ['prometheus', 'loki']) {
  if (!datasources.some((item) => item.uid === uid)) throw new Error(`Datasource ausente: ${uid}`);
}

const dashboards = await requestJson('http://127.0.0.1:3000/api/search?query=BarberCloud', { headers });
for (const uid of [
  'barbercloud-observabilidad',
  'barbercloud-aplicacion-negocio',
  'barbercloud-logs',
]) {
  if (!dashboards.some((item) => item.uid === uid)) throw new Error(`Dashboard ausente: ${uid}`);
}

const alerts = await requestJson('http://127.0.0.1:3000/api/v1/provisioning/alert-rules', { headers });
for (const uid of ['barbercloud_cpu_backend_50', 'barbercloud_backend_down']) {
  if (!alerts.some((item) => item.uid === uid)) throw new Error(`Alerta ausente: ${uid}`);
}

const contactPoints = await requestJson('http://127.0.0.1:3000/api/v1/provisioning/contact-points', { headers });
if (!contactPoints.some((item) => item.name === 'BarberCloud Webhook')) {
  throw new Error('Contact point BarberCloud Webhook ausente.');
}

const queryLoki = async (query) => requestJson(
  `http://127.0.0.1:3100/loki/api/v1/query_range?${new URLSearchParams({ query, limit: '20' })}`,
);

const applicationLogs = await queryLoki('{tier="application"}');
if (!applicationLogs.data.result.length) throw new Error('Loki no tiene logs de aplicación.');

const infrastructureLogs = await queryLoki('{tier="infrastructure"}');
if (!infrastructureLogs.data.result.length) throw new Error('Loki no tiene logs de infraestructura.');

const webhookResponse = await request('http://127.0.0.1:3001/alerts/grafana', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${env.GRAFANA_WEBHOOK_TOKEN}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    status: 'firing',
    alerts: [{ labels: { alertname: 'Prueba automatizada' } }],
  }),
});
if (webhookResponse.status !== 202) throw new Error('Webhook no aceptado.');

console.log('✓ Servicios de aplicación disponibles');
console.log('✓ Prometheus, Loki y Alloy disponibles');
console.log('✓ Targets Prometheus en estado UP');
console.log('✓ Logs de aplicación e infraestructura presentes');
console.log('✓ Dashboards, alertas y contact point aprovisionados');
console.log('✓ Webhook de Grafana protegido y operativo');
