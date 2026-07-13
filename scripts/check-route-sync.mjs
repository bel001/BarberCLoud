import { readFile } from 'node:fs/promises';

const localText = await readFile(new URL('../backend/src/local-server.js', import.meta.url), 'utf8');
const terraformText = await readFile(new URL('../iac/api_gateway.tf', import.meta.url), 'utf8');

const normalize = (method, path) => `${method.toUpperCase()} ${path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
const localRoutes = new Set();
for (const match of localText.matchAll(/app\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g)) {
  const route = normalize(match[1], match[2]);
  if (!route.includes('/api/auth/') && !route.endsWith(' /health')) localRoutes.add(route);
}

const cloudRoutes = new Set();
for (const match of terraformText.matchAll(/"(GET|POST|PUT|PATCH|DELETE) ([^"]+)"\s*=/g)) {
  cloudRoutes.add(`${match[1]} ${match[2]}`);
}

const missingCloud = [...localRoutes].filter((route) => !cloudRoutes.has(route)).sort();
const cloudOnly = [...cloudRoutes].filter((route) => !localRoutes.has(route)).sort();

console.log(`Rutas locales de negocio: ${localRoutes.size}`);
console.log(`Rutas publicadas por Terraform: ${cloudRoutes.size}`);
if (missingCloud.length) console.error('Faltan en Terraform:\n' + missingCloud.join('\n'));
if (cloudOnly.length) console.error('Solo existen en Terraform:\n' + cloudOnly.join('\n'));
if (missingCloud.length || cloudOnly.length) process.exit(1);
console.log('Sincronización local/AWS correcta. /health y /api/auth/* son locales por diseño; Cognito los reemplaza en AWS.');
