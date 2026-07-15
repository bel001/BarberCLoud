import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  consumeOAuthTransaction,
  createOAuthTransaction,
  OAUTH_TRANSACTION_KEY,
  OAUTH_TRANSACTION_TTL_MS
} from '../../../frontend/assets/js/oauth-transaction.js';

class MemoryStorage {
  items = new Map();

  getItem(key) {
    return this.items.get(key) ?? null;
  }

  setItem(key, value) {
    this.items.set(key, value);
  }

  removeItem(key) {
    this.items.delete(key);
  }
}

describe('transacción OAuth con state y PKCE', () => {
  it('crea y consume una transacción válida una sola vez', async () => {
    const storage = new MemoryStorage();
    const created = await createOAuthTransaction({ storage, cryptoApi: webcrypto, now: 1_000 });

    expect(created.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.parse(storage.getItem(OAUTH_TRANSACTION_KEY))).toMatchObject({
      state: created.state,
      verifier: created.verifier,
      createdAt: 1_000
    });

    expect(consumeOAuthTransaction(created.state, { storage, now: 2_000 })).toMatchObject({
      state: created.state,
      verifier: created.verifier
    });
    expect(storage.getItem(OAUTH_TRANSACTION_KEY)).toBeNull();
    expect(() => consumeOAuthTransaction(created.state, { storage, now: 2_000 })).toThrow(/no existe/i);
  });

  it('rechaza state incorrecto y elimina la transacción', async () => {
    const storage = new MemoryStorage();
    await createOAuthTransaction({ storage, cryptoApi: webcrypto, now: 1_000 });

    expect(() => consumeOAuthTransaction('state-manipulado', { storage, now: 2_000 })).toThrow(/no coincide/i);
    expect(storage.getItem(OAUTH_TRANSACTION_KEY)).toBeNull();
  });

  it('rechaza transacciones vencidas', async () => {
    const storage = new MemoryStorage();
    const created = await createOAuthTransaction({ storage, cryptoApi: webcrypto, now: 1_000 });

    expect(() => consumeOAuthTransaction(created.state, {
      storage,
      now: 1_000 + OAUTH_TRANSACTION_TTL_MS + 1
    })).toThrow(/venció/i);
  });
});
