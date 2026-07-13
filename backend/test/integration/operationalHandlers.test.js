import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lambdaEvent, parseBody } from '../helpers/events.js';

const mocks = vi.hoisted(() => ({
  createAppointment: vi.fn(), listAppointments: vi.fn(), updateAppointmentStatus: vi.fn(), getAvailability: vi.fn(), listBarbers: vi.fn(),
  createSale: vi.fn(), listSales: vi.fn(), openCash: vi.fn(), closeCash: vi.fn(), getCurrentCashSession: vi.fn(),
  createInventoryItem: vi.fn(), updateInventory: vi.fn(), listInventory: vi.fn(), registerUsage: vi.fn(),
  createClientByStaff: vi.fn(), listUsers: vi.fn(), createStaff: vi.fn(), updateStaff: vi.fn(), getUser: vi.fn(), updateProfile: vi.fn(), upsertCognitoClient: vi.fn(),
  getFinance: vi.fn(), createService: vi.fn(), updateService: vi.fn(), listServices: vi.fn(),
  getBusinessConfig: vi.fn(), updateBusinessConfig: vi.fn(), scanByType: vi.fn(), cognitoSend: vi.fn()
}));

vi.mock('../../src/services/appointment-service.js', () => ({
  createAppointment: mocks.createAppointment,
  listAppointments: mocks.listAppointments,
  updateAppointmentStatus: mocks.updateAppointmentStatus,
  getAvailability: mocks.getAvailability, listBarbers: mocks.listBarbers
}));
vi.mock('../../src/services/pos-service.js', () => ({
  createSale: mocks.createSale, listSales: mocks.listSales, openCash: mocks.openCash,
  closeCash: mocks.closeCash, getCurrentCashSession: mocks.getCurrentCashSession
}));
vi.mock('../../src/services/inventory-service.js', () => ({
  createInventoryItem: mocks.createInventoryItem, updateInventory: mocks.updateInventory,
  listInventory: mocks.listInventory, registerUsage: mocks.registerUsage
}));
vi.mock('../../src/services/user-service.js', () => ({
  createClientByStaff: mocks.createClientByStaff, listUsers: mocks.listUsers,
  createStaff: mocks.createStaff, updateStaff: mocks.updateStaff, getUser: mocks.getUser,
  updateProfile: mocks.updateProfile, upsertCognitoClient: mocks.upsertCognitoClient
}));
vi.mock('../../src/services/finance-service.js', () => ({ getFinance: mocks.getFinance }));

vi.mock('../../src/lib/repository.js', () => ({ scanByType: mocks.scanByType }));
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  AdminAddUserToGroupCommand: class AdminAddUserToGroupCommand { constructor(input) { this.input = input; } },
  CognitoIdentityProviderClient: class CognitoIdentityProviderClient { send(command) { return mocks.cognitoSend(command); } }
}));

vi.mock('../../src/services/business-service.js', () => ({
  createService: mocks.createService, updateService: mocks.updateService,
  listServices: mocks.listServices, getBusinessConfig: mocks.getBusinessConfig,
  updateBusinessConfig: mocks.updateBusinessConfig
}));

import { handler as agendaGlobalHandler } from '../../src/handlers/gestionAgendaGlobal.js';
import { handler as barberAgendaHandler } from '../../src/handlers/gestionAgendaBarbero.js';
import { handler as posHandler } from '../../src/handlers/gestionPOS.js';
import { handler as inventoryHandler } from '../../src/handlers/gestionInventario.js';
import { handler as suppliesHandler } from '../../src/handlers/gestionInsumos.js';
import { handler as clientsHandler } from '../../src/handlers/gestionClientes.js';
import { handler as staffHandler } from '../../src/handlers/gestionPersonal.js';
import { handler as financeHandler } from '../../src/handlers/gestionFinanciera.js';
import { handler as businessHandler } from '../../src/handlers/gestionNegocio.js';

import { handler as availabilityHandler } from '../../src/handlers/consultarDisponibilidad.js';
import { handler as accountHandler } from '../../src/handlers/gestionCuentaCliente.js';
import { handler as dashboardHandler } from '../../src/handlers/gestionDashboard.js';
import { handler as auditHandler } from '../../src/handlers/gestionAuditoria.js';
import { handler as manageServicesHandler } from '../../src/handlers/manageServices.js';
import { handler as publicCatalogHandler } from '../../src/handlers/publicCatalog.js';
import { handler as postConfirmHandler } from '../../src/handlers/postConfirmCliente.js';

describe('operational handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAppointments.mockResolvedValue([]);
    mocks.listSales.mockResolvedValue([]);
    mocks.listInventory.mockResolvedValue([]);
    mocks.listUsers.mockResolvedValue([]);
    mocks.listServices.mockResolvedValue([]);
    mocks.getBusinessConfig.mockResolvedValue({ openTime: '09:00' });
    mocks.getFinance.mockResolvedValue({ income: 0 });
    mocks.getAvailability.mockResolvedValue(['09:00']);
    mocks.listBarbers.mockResolvedValue([{ id: 'b1' }]);
    mocks.getUser.mockResolvedValue({ id: 'c1', role: 'CLIENTE' });
    mocks.updateProfile.mockResolvedValue({ id: 'c1', name: 'Nuevo' });
    mocks.upsertCognitoClient.mockResolvedValue({ id: 'c1' });
    mocks.scanByType.mockResolvedValue([]);
    mocks.cognitoSend.mockResolvedValue({});
  });

  it('secretaria y admin consultan agenda global', async () => {
    for (const role of ['SECRETARIA', 'ADMIN']) {
      const response = await agendaGlobalHandler(lambdaEvent({ role, rawPath: `/api/${role.toLowerCase()}/agenda` }));
      expect(response.statusCode).toBe(200);
    }
    expect(mocks.listAppointments).toHaveBeenCalledTimes(2);
  });

  it('secretaria crea cita presencial', async () => {
    mocks.createAppointment.mockResolvedValue({ id: 'a1', source: 'PRESENCIAL' });
    const response = await agendaGlobalHandler(lambdaEvent({
      role: 'SECRETARIA', method: 'POST', rawPath: '/api/secretary/appointments',
      body: { clientId: 'c1', serviceId: 's1', barberId: 'b1', date: '2026-07-15', time: '09:00' }
    }));
    expect(parseBody(response).data.source).toBe('PRESENCIAL');
    expect(mocks.createAppointment).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'PRESENCIAL');
  });

  it('barbero actualiza estado solo a través de su handler', async () => {
    mocks.updateAppointmentStatus.mockResolvedValue({ id: 'a1', status: 'ATENDIDA' });
    const response = await barberAgendaHandler(lambdaEvent({
      role: 'BARBERO', user: { sub: 'b1' }, method: 'PATCH',
      pathParameters: { id: 'a1' }, body: { status: 'ATENDIDA' }
    }));
    expect(parseBody(response).data.status).toBe('ATENDIDA');
    expect(mocks.updateAppointmentStatus).toHaveBeenCalledWith('a1', 'ATENDIDA', expect.objectContaining({ sub: 'b1' }));
  });

  it('POS enruta apertura, cierre, sesión y venta', async () => {
    mocks.getCurrentCashSession.mockResolvedValue({ id: 'cash-1' });
    let response = await posHandler(lambdaEvent({ role: 'SECRETARIA', rawPath: '/api/secretary/cash/current' }));
    expect(parseBody(response).data.id).toBe('cash-1');

    mocks.openCash.mockResolvedValue({ id: 'cash-1', status: 'OPEN' });
    response = await posHandler(lambdaEvent({ role: 'SECRETARIA', method: 'POST', rawPath: '/api/secretary/cash/open', body: { openingAmount: 100 } }));
    expect(parseBody(response).data.status).toBe('OPEN');

    mocks.closeCash.mockResolvedValue({ id: 'cash-1', status: 'CLOSED' });
    response = await posHandler(lambdaEvent({ role: 'SECRETARIA', method: 'POST', rawPath: '/api/secretary/cash/close', body: { closingAmount: 100 } }));
    expect(parseBody(response).data.status).toBe('CLOSED');

    mocks.createSale.mockResolvedValue({ id: 'sale-1', total: 30 });
    response = await posHandler(lambdaEvent({ role: 'SECRETARIA', method: 'POST', rawPath: '/api/secretary/pos/sales', body: { items: [{}], paymentMethod: 'YAPE' } }));
    expect(parseBody(response).data.total).toBe(30);
  });

  it('inventario crea, actualiza, lista y registra consumo', async () => {
    mocks.createInventoryItem.mockResolvedValue({ id: 'i1' });
    expect((await inventoryHandler(lambdaEvent({ role: 'SECRETARIA', method: 'POST', body: { name: 'Gel' } }))).statusCode).toBe(200);

    mocks.updateInventory.mockResolvedValue({ id: 'i1', stock: 5 });
    const updateResponse = await inventoryHandler(lambdaEvent({ role: 'SECRETARIA', method: 'PATCH', pathParameters: { id: 'i1' }, body: { stock: 5 } }));
    expect(parseBody(updateResponse).data.stock).toBe(5);

    mocks.registerUsage.mockResolvedValue({ id: 'i1', stock: 4 });
    const usageResponse = await suppliesHandler(lambdaEvent({ role: 'BARBERO', method: 'POST', body: { inventoryId: 'i1', quantity: 1 } }));
    expect(parseBody(usageResponse).data.stock).toBe(4);
  });

  it('gestiona clientes, personal, finanzas y negocio', async () => {
    mocks.createClientByStaff.mockResolvedValue({ user: { id: 'c1' } });
    expect(parseBody(await clientsHandler(lambdaEvent({ role: 'SECRETARIA', method: 'POST', body: { name: 'Juan' } }))).data.user.id).toBe('c1');

    mocks.createStaff.mockResolvedValue({ id: 'b1', role: 'BARBERO' });
    expect(parseBody(await staffHandler(lambdaEvent({ role: 'ADMIN', method: 'POST', body: { name: 'Barbero' } }))).data.role).toBe('BARBERO');

    expect(parseBody(await financeHandler(lambdaEvent({ role: 'ADMIN' }))).data.income).toBe(0);

    mocks.createService.mockResolvedValue({ id: 's1', name: 'Corte' });
    const serviceResponse = await businessHandler(lambdaEvent({
      role: 'ADMIN', method: 'POST', rawPath: '/api/admin/services', body: { name: 'Corte', duration: 30, price: 30 }
    }));
    expect(parseBody(serviceResponse).data.id).toBe('s1');
  });


  it('cubre catálogo, disponibilidad y cuenta del cliente', async () => {
    let response = await availabilityHandler(lambdaEvent({ rawPath: '/api/public/availability', queryStringParameters: { date: '2026-07-15' } }));
    expect(parseBody(response).data).toEqual(['09:00']);

    response = await publicCatalogHandler(lambdaEvent({ rawPath: '/api/public/services' }));
    expect(response.statusCode).toBe(200);
    response = await publicCatalogHandler(lambdaEvent({ rawPath: '/api/public/barbers' }));
    expect(parseBody(response).data).toEqual([{ id: 'b1' }]);
    response = await publicCatalogHandler(lambdaEvent({ rawPath: '/api/public/business' }));
    expect(parseBody(response).data.openTime).toBe('09:00');

    response = await accountHandler(lambdaEvent({ role: 'CLIENTE', user: { sub: 'c1' } }));
    expect(parseBody(response).data.id).toBe('c1');
    response = await accountHandler(lambdaEvent({ role: 'CLIENTE', user: { sub: 'c1' }, method: 'PUT', body: { name: 'Nuevo' } }));
    expect(parseBody(response).data.name).toBe('Nuevo');
  });

  it('cubre dashboard, auditoría y tarea programada', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mocks.listUsers.mockResolvedValue([{ id: 'c1', role: 'CLIENTE' }, { id: 'b1', role: 'BARBERO' }]);
    mocks.listInventory.mockResolvedValue([{ id: 'i1', stock: 1, minimum: 2 }]);
    mocks.listAppointments.mockResolvedValue([{ id: 'a1', date: today }]);
    let response = await dashboardHandler(lambdaEvent({ role: 'ADMIN' }));
    expect(parseBody(response).data).toMatchObject({ users: 2, clients: 1, staff: 1, lowStock: 1, appointmentsToday: 1 });

    mocks.scanByType.mockResolvedValue([
      { id: 'old', createdAt: '2026-07-01T10:00:00Z' },
      { id: 'new', createdAt: '2026-07-02T10:00:00Z' }
    ]);
    response = await auditHandler(lambdaEvent({ role: 'ADMIN' }));
    expect(parseBody(response).data[0].id).toBe('new');

    mocks.scanByType.mockResolvedValue([
      { status: 'PENDIENTE', date: '2020-01-01', time: '09:00' },
      { status: 'ATENDIDA', date: '2020-01-01', time: '10:00' }
    ]);
    response = await manageServicesHandler({});
    expect(parseBody(response).data).toEqual({ checked: 2, expiredCandidates: 1 });
  });

  it('crea perfil de cliente después de confirmación Cognito', async () => {
    const event = {
      userPoolId: 'pool', userName: 'cliente@demo.local',
      request: { userAttributes: { sub: 'c1', email: 'cliente@demo.local', name: 'Cliente', phone_number: '+51999999999' } }
    };
    const result = await postConfirmHandler(event);
    expect(result).toBe(event);
    expect(mocks.cognitoSend).toHaveBeenCalledOnce();
    expect(mocks.upsertCognitoClient).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', email: 'cliente@demo.local' }));
  });

  it('bloquea cliente en operaciones internas', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await inventoryHandler(lambdaEvent({ role: 'CLIENTE' }));
    expect(response.statusCode).toBe(403);
    spy.mockRestore();
  });

  it('cubre consulta y actualización de personal', async () => {
    mocks.listUsers.mockResolvedValue([
      { id: 'c1', role: 'CLIENTE' },
      { id: 'b1', role: 'BARBERO' }
    ]);

    let response = await staffHandler(lambdaEvent({
      role: 'ADMIN',
      method: 'GET',
      rawPath: '/api/admin/staff',
      queryStringParameters: { search: 'barbero' }
    }));

    expect(parseBody(response).data).toEqual([
      { id: 'b1', role: 'BARBERO' }
    ]);

    mocks.updateStaff.mockResolvedValue({
      id: 'b1',
      role: 'BARBERO',
      active: false
    });

    response = await staffHandler(lambdaEvent({
      role: 'ADMIN',
      method: 'PATCH',
      rawPath: '/api/admin/staff/b1',
      pathParameters: { id: 'b1' },
      body: { active: false }
    }));

    expect(parseBody(response).data.active).toBe(false);

    expect(mocks.updateStaff).toHaveBeenCalledWith(
      'b1',
      { active: false },
      expect.objectContaining({ role: 'ADMIN' })
    );
  });

  it('cubre consulta y actualización de servicios y configuración', async () => {
    mocks.listServices.mockResolvedValue([
      { id: 's1', active: true }
    ]);

    let response = await businessHandler(lambdaEvent({
      role: 'ADMIN',
      method: 'GET',
      rawPath: '/api/admin/services'
    }));

    expect(parseBody(response).data).toHaveLength(1);

    mocks.updateService.mockResolvedValue({
      id: 's1',
      price: 40
    });

    response = await businessHandler(lambdaEvent({
      role: 'ADMIN',
      method: 'PATCH',
      rawPath: '/api/admin/services/s1',
      pathParameters: { id: 's1' },
      body: { price: 40 }
    }));

    expect(parseBody(response).data.price).toBe(40);

    response = await businessHandler(lambdaEvent({
      role: 'ADMIN',
      method: 'GET',
      rawPath: '/api/admin/business'
    }));

    expect(parseBody(response).data.openTime).toBe('09:00');

    mocks.updateBusinessConfig.mockResolvedValue({
      openTime: '10:00'
    });

    response = await businessHandler(lambdaEvent({
      role: 'ADMIN',
      method: 'PATCH',
      rawPath: '/api/admin/business',
      body: { openTime: '10:00' }
    }));

    expect(parseBody(response).data.openTime).toBe('10:00');
  });

});
