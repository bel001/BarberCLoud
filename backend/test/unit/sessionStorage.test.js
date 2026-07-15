import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  readSession,
  sanitizeSession,
  sanitizeToken,
  SESSION_KEY,
  writeSession,
} from '../../../frontend/assets/js/session-storage.js';

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

const validSession = {
  token: 'payload.signature',
  user: {
    id: 'user-123',
    name: 'Rodrigo Rodríguez',
    email: 'rodrigo@example.com',
    role: 'CLIENTE',
  },
};

describe('almacenamiento seguro de sesión', () => {
  it('acepta tokens locales y JWT de Cognito', () => {
    expect(
      sanitizeToken('payload.signature'),
    ).toBe('payload.signature');

    expect(
      sanitizeToken('header.payload.signature'),
    ).toBe('header.payload.signature');
  });

  it('rechaza tokens con caracteres inseguros', () => {
    expect(
      sanitizeToken(
        'payload.<script>alert(1)</script>',
      ),
    ).toBeNull();

    expect(
      sanitizeToken('token-sin-separador'),
    ).toBeNull();
  });

  it('solo conserva los campos autorizados', () => {
    const sanitized = sanitizeSession({
      ...validSession,
      user: {
        ...validSession.user,
        name: 'Rodrigo <script>alert(1)</script>',
        ignored: '<img src=x onerror=alert(1)>',
      },
      arbitrary: 'no debe almacenarse',
    });

    expect(sanitized).toEqual({
      token: 'payload.signature',
      user: {
        id: 'user-123',
        name: 'Rodrigo alert1',
        email: 'rodrigo@example.com',
        role: 'CLIENTE',
      },
    });

    expect(sanitized).not.toHaveProperty(
      'arbitrary',
    );

    expect(sanitized.user).not.toHaveProperty(
      'ignored',
    );
  });

  it('rechaza roles no permitidos', () => {
    expect(
      sanitizeSession({
        ...validSession,
        user: {
          ...validSession.user,
          role: 'SUPERADMIN',
        },
      }),
    ).toBeNull();
  });

  it('almacena únicamente la sesión sanitizada', () => {
    const storage = new MemoryStorage();

    writeSession(storage, {
      ...validSession,
      user: {
        ...validSession.user,
        name: 'Rodrigo <b>Seguro</b>',
      },
    });

    const saved = JSON.parse(
      storage.getItem(SESSION_KEY),
    );

    expect(saved.user.name).toBe(
      'Rodrigo Seguro',
    );

    expect(saved.user.name).not.toContain('<');
    expect(saved.user.name).not.toContain('>');
  });

  it('elimina sesiones manipuladas al leerlas', () => {
    const storage = new MemoryStorage();

    storage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: 'token<script>.firma',
        user: validSession.user,
      }),
    );

    expect(readSession(storage)).toBeNull();

    expect(
      storage.getItem(SESSION_KEY),
    ).toBeNull();
  });

  it('recupera una sesión válida', () => {
    const storage = new MemoryStorage();

    writeSession(storage, validSession);

    expect(readSession(storage)).toEqual(
      validSession,
    );
  });
});
