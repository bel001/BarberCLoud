import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  items: new Map(),
  audit: vi.fn()
}));

vi.mock('../../src/lib/config.js', () => ({
  config: { region: 'us-east-1', userPoolId: '', dynamodbEndpoint: 'http://dynamodb:8000', authSecret: 'test-secret' },
  isAwsRuntime: () => false
}));
vi.mock('../../src/lib/audit.js', () => ({ audit: state.audit }));
vi.mock('../../src/lib/repository.js', () => ({
  putItem: vi.fn(async (item) => { state.items.set(item.PK, item); return item; }),
  getItem: vi.fn(async (pk) => state.items.get(pk) || null),
  scanByType: vi.fn(async (entityType) => [...state.items.values()].filter((item) => item.entityType === entityType)),
  updateItem: vi.fn(async (pk, updates) => {
    const current = state.items.get(pk) || { PK: pk, SK: 'META' };
    const updated = { ...current, ...updates };
    state.items.set(pk, updated);
    return updated;
  })
}));

import {
  createService, getBusinessConfig, getService, listServices, updateBusinessConfig, updateService
} from '../../src/services/business-service.js';
import {
  createInventoryItem, listInventory, registerUsage, updateInventory
} from '../../src/services/inventory-service.js';
import {
  createClientByStaff, createStaff, findUserByEmail, getUser, listUsers, login,
  registerClient, updateProfile, updateStaff, upsertCognitoClient
} from '../../src/services/user-service.js';

const admin = { sub: 'admin-1', role: 'ADMIN' };
const secretary = { sub: 'secretary-1', role: 'SECRETARIA' };

describe('business, inventory and user services', () => {
  beforeEach(() => {
    state.items.clear();
    state.audit.mockClear();
    state.items.set('BUSINESS#CONFIG', {
      PK: 'BUSINESS#CONFIG', SK: 'META', entityType: 'BUSINESS_CONFIG',
      name: 'BarberCloud', phone: '999999999', address: 'Centro',
      openTime: '09:00', closeTime: '19:00', slotMinutes: 30,
      cancellationHours: 2, currency: 'PEN'
    });
  });

  it('crea, lista, obtiene y actualiza servicios', async () => {
    const service = await createService({ name: ' Corte clásico ', description: 'Profesional', duration: 30, price: 30 }, admin);
    expect(service).toMatchObject({ name: 'Corte clásico', duration: 30, price: 30, active: true });
    expect(await getService(service.id)).toMatchObject({ id: service.id });
    expect(await listServices()).toHaveLength(1);

    const updated = await updateService(service.id, { price: 35, active: false }, admin);
    expect(updated).toMatchObject({ price: 35, active: false });
    expect(await listServices()).toHaveLength(0);
    expect(await listServices({ activeOnly: false })).toHaveLength(1);
  });

  it('valida servicio y actualiza configuración del negocio', async () => {
    await expect(createService({ name: 'X', duration: 5, price: -1 }, admin)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((await getBusinessConfig()).openTime).toBe('09:00');
    const config = await updateBusinessConfig({ closeTime: '20:00', slotMinutes: 20 }, admin);
    expect(config).toMatchObject({ closeTime: '20:00', slotMinutes: 20 });
  });

  it('crea, ordena y actualiza inventario', async () => {
    const gel = await createInventoryItem({ name: 'Gel', stock: 10, unit: 'unidad', minimum: 2, cost: 5 }, secretary);
    const alcohol = await createInventoryItem({ name: 'Alcohol', stock: 5, unit: 'botella', minimum: 1 }, secretary);
    expect((await listInventory()).map((item) => item.name)).toEqual(['Alcohol', 'Gel']);

    expect(await updateInventory(gel.id, { stock: 8 }, secretary)).toMatchObject({ stock: 8 });
    await expect(updateInventory(gel.id, { stock: -1 }, secretary)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const used = await registerUsage({ inventoryId: alcohol.id, quantity: 2, appointmentId: 'a1' }, { sub: 'b1', role: 'BARBERO' });
    expect(used.stock).toBe(3);
    await expect(registerUsage({ inventoryId: alcohol.id, quantity: 10 }, { sub: 'b1', role: 'BARBERO' }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
  });

  it('registra cliente, inicia sesión y oculta el hash', async () => {
    const registered = await registerClient({
      name: 'Ana Cliente', email: 'ana@correo.com', phone: '999111222', password: 'Segura123!'
    });
    expect(registered.token).toContain('.');
    expect(registered.user.passwordHash).toBeUndefined();

    const logged = await login({ email: 'ANA@CORREO.COM', password: 'Segura123!' });
    expect(logged.user.email).toBe('ana@correo.com');
    await expect(login({ email: 'ana@correo.com', password: 'incorrecta' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect((await findUserByEmail('ana@correo.com')).id).toBe(registered.user.id);
  });

  it('secretaria crea cliente con contraseña temporal y evita duplicados', async () => {
    const result = await createClientByStaff({ name: 'Juan', email: 'juan@correo.com', phone: '988777666' }, secretary);
    expect(result.user.role).toBe('CLIENTE');
    expect(result.temporaryPassword.length).toBeGreaterThan(8);
    await expect(createClientByStaff({ name: 'Juan', email: 'juan@correo.com', phone: '988777666' }, secretary))
      .rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
  });

  it('crea perfil Cognito, consulta y actualiza cuenta', async () => {
    const profile = await upsertCognitoClient({ id: 'cognito-1', name: 'Lucía', email: 'lucia@correo.com', phone: '+51999111222' });
    expect(profile.id).toBe('cognito-1');
    expect((await getUser('cognito-1')).name).toBe('Lucía');
    expect((await updateProfile('cognito-1', { name: 'Lucía P.', phone: '900000000' }, { sub: 'cognito-1', role: 'CLIENTE' })))
      .toMatchObject({ name: 'Lucía P.', phone: '900000000' });
    expect((await upsertCognitoClient({ id: 'cognito-1', email: 'lucia@correo.com' })).name).toBe('Lucía P.');
  });

  it('admin crea, filtra y actualiza personal', async () => {
    const staff = await createStaff({
      name: 'Carlos Barbero', email: 'carlos@barbercloud.com', phone: '999222333', role: 'BARBERO', specialties: ['Fade']
    }, admin);
    expect(staff).toMatchObject({ role: 'BARBERO', active: true });
    expect((await listUsers({ role: 'BARBERO', search: 'carlos' }))).toHaveLength(1);

    const updated = await updateStaff(staff.id, { active: false, phone: '911111111' }, admin);
    expect(updated).toMatchObject({ active: false, phone: '911111111' });
    await expect(createStaff({ name: 'X', email: 'x@x.com', phone: '1', role: 'CLIENTE' }, admin))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
