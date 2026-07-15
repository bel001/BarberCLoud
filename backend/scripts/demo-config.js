const allowedDemoEnvironments = new Set(['local', 'dev']);
const forbiddenDemoPasswords = new Set([
  'barbercloud2026!',
  'define-un-secreto-temporal'
]);

export function validateDemoConfiguration(environment = process.env) {
  const demoEnvironment = String(environment.DEMO_ENVIRONMENT || '').trim().toLowerCase();
  if (!allowedDemoEnvironments.has(demoEnvironment)) {
    throw new Error('Define DEMO_ENVIRONMENT como local o dev. Este script no puede ejecutarse en staging ni produccion.');
  }

  const password = String(environment.DEMO_PASSWORD || '');
  if (password.length < 12 || forbiddenDemoPasswords.has(password.toLowerCase())) {
    throw new Error('Define DEMO_PASSWORD explicitamente con al menos 12 caracteres y sin valores de ejemplo.');
  }

  if (!environment.USER_POOL_ID || !environment.TABLE_NAME) {
    throw new Error('Define USER_POOL_ID y TABLE_NAME antes de ejecutar este script.');
  }

  return {
    demoEnvironment,
    password,
    userPoolId: environment.USER_POOL_ID
  };
}
