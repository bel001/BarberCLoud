import { describe, expect, it } from 'vitest';
import { validateDemoConfiguration } from '../../scripts/demo-config.js';

function configuration(overrides = {}) {
  return {
    USER_POOL_ID: 'pool-test',
    TABLE_NAME: 'table-test',
    DEMO_ENVIRONMENT: 'dev',
    DEMO_PASSWORD: 'TemporalSeguro2026!',
    ...overrides
  };
}

describe('provisión de usuarios demo', () => {
  it('rechaza ambientes no declarados, staging o producción antes de llamar AWS', () => {
    expect(() => validateDemoConfiguration(configuration({ DEMO_ENVIRONMENT: '' }))).toThrow(/DEMO_ENVIRONMENT/);
    expect(() => validateDemoConfiguration(configuration({ DEMO_ENVIRONMENT: 'staging' }))).toThrow(/staging/i);
    expect(() => validateDemoConfiguration(configuration({ DEMO_ENVIRONMENT: 'production' }))).toThrow(/produccion/i);
  });

  it('rechaza contraseñas ausentes, cortas, históricas o de ejemplo', () => {
    for (const password of ['', 'Corta2026!', 'BarberCloud2026!', 'define-un-secreto-temporal']) {
      expect(() => validateDemoConfiguration(configuration({ DEMO_PASSWORD: password }))).toThrow(/DEMO_PASSWORD/);
    }
  });

  it('acepta una configuración local explícita y segura', () => {
    expect(validateDemoConfiguration(configuration({ DEMO_ENVIRONMENT: ' LOCAL ' }))).toEqual({
      demoEnvironment: 'local',
      password: 'TemporalSeguro2026!',
      userPoolId: 'pool-test'
    });
  });
});
