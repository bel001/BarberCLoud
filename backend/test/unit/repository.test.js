import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('../../src/lib/db.js', () => ({ documentClient: { send } }));
vi.mock('../../src/lib/config.js', () => ({ config: { tableName: 'barbercloud-test' } }));

const repository = await import('../../src/lib/repository.js');

describe('repositorio DynamoDB', () => {
  beforeEach(() => send.mockReset());

  it('guarda y devuelve el mismo elemento', async () => {
    send.mockResolvedValue({});
    const item = { PK: 'USER#1', SK: 'META', name: 'Cliente' };

    await expect(repository.putItem(item)).resolves.toBe(item);
    expect(send.mock.calls[0][0].input).toEqual({ TableName: 'barbercloud-test', Item: item });
  });

  it('obtiene un elemento o null cuando no existe', async () => {
    send.mockResolvedValueOnce({ Item: { PK: 'USER#1' } }).mockResolvedValueOnce({});

    await expect(repository.getItem('USER#1')).resolves.toEqual({ PK: 'USER#1' });
    await expect(repository.getItem('USER#2', 'PROFILE')).resolves.toBeNull();
    expect(send.mock.calls[1][0].input.Key).toEqual({ PK: 'USER#2', SK: 'PROFILE' });
  });

  it('elimina usando META como clave secundaria predeterminada', async () => {
    send.mockResolvedValue({});

    await repository.deleteItem('USER#1');
    expect(send.mock.calls[0][0].input).toEqual({
      TableName: 'barbercloud-test',
      Key: { PK: 'USER#1', SK: 'META' }
    });
  });

  it('escanea por tipo y normaliza una respuesta sin elementos', async () => {
    send.mockResolvedValueOnce({ Items: [{ id: '1' }] }).mockResolvedValueOnce({});

    await expect(repository.scanByType('USER')).resolves.toEqual([{ id: '1' }]);
    await expect(repository.scanByType('USER')).resolves.toEqual([]);
    expect(send.mock.calls[0][0].input.ExpressionAttributeValues).toEqual({ ':entityType': 'USER' });
  });

  it('escanea toda la tabla y normaliza una respuesta vacía', async () => {
    send.mockResolvedValueOnce({ Items: [{ id: '1' }] }).mockResolvedValueOnce({});

    await expect(repository.scanAll()).resolves.toEqual([{ id: '1' }]);
    await expect(repository.scanAll()).resolves.toEqual([]);
  });

  it('construye una actualización parametrizada y devuelve sus atributos', async () => {
    send.mockResolvedValue({ Attributes: { PK: 'USER#1', name: 'Nombre nuevo', active: false } });

    await expect(repository.updateItem('USER#1', { name: 'Nombre nuevo', active: false })).resolves.toEqual({
      PK: 'USER#1',
      name: 'Nombre nuevo',
      active: false
    });
    expect(send.mock.calls[0][0].input).toEqual({
      TableName: 'barbercloud-test',
      Key: { PK: 'USER#1', SK: 'META' },
      UpdateExpression: 'SET #k0 = :v0, #k1 = :v1',
      ExpressionAttributeNames: { '#k0': 'name', '#k1': 'active' },
      ExpressionAttributeValues: { ':v0': 'Nombre nuevo', ':v1': false },
      ReturnValues: 'ALL_NEW'
    });
  });
});
