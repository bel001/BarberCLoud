import { beforeEach, describe, expect, it, vi } from 'vitest';

const { putItemMock } = vi.hoisted(() => ({ putItemMock: vi.fn(async (item) => item) }));
vi.mock('../../src/lib/repository.js', () => ({ putItem: putItemMock }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'audit-id' }));

import { audit } from '../../src/lib/audit.js';

describe('audit', () => {
  beforeEach(() => putItemMock.mockClear());

  it('registra acción, actor, recurso y detalles', async () => {
    await audit({
      actorId: 'admin-1', actorRole: 'ADMIN', action: 'CREATE_SERVICE',
      resource: 'SERVICE#corte', details: { price: 30 }
    });
    expect(putItemMock).toHaveBeenCalledTimes(1);
    expect(putItemMock.mock.calls[0][0]).toMatchObject({
      PK: 'AUDIT#audit-id', entityType: 'AUDIT', actorId: 'admin-1',
      actorRole: 'ADMIN', action: 'CREATE_SERVICE', resource: 'SERVICE#corte',
      details: { price: 30 }
    });
  });

  it('usa SYSTEM por defecto', async () => {
    await audit({ action: 'CRON_JOB', resource: 'SYSTEM' });
    expect(putItemMock.mock.calls[0][0]).toMatchObject({ actorId: 'SYSTEM', actorRole: 'SYSTEM' });
  });
});
