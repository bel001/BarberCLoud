export const SESSION_KEY = 'barbercloud_session';

const ALLOWED_ROLES = new Set([
  'CLIENTE',
  'BARBERO',
  'SECRETARIA',
  'ADMIN',
]);

function sanitizeTokenSegment(value) {
  const raw = String(value ?? '').trim();

  if (!raw || raw.length > 4096) {
    return null;
  }

  const sanitized = raw.replace(
    /[^A-Za-z0-9_-]/g,
    '',
  );

  return sanitized === raw
    ? sanitized
    : null;
}

export function sanitizeToken(value) {
  const raw = String(value ?? '').trim();

  if (!raw || raw.length > 8192) {
    return null;
  }

  const segments = raw.split('.');

  // El token local tiene dos segmentos.
  // Los JWT de Cognito tienen tres segmentos.
  if (![2, 3].includes(segments.length)) {
    return null;
  }

  const sanitizedSegments = segments.map(
    sanitizeTokenSegment,
  );

  if (sanitizedSegments.some((segment) => !segment)) {
    return null;
  }

  return sanitizedSegments.join('.');
}

function sanitizeIdentifier(value) {
  const raw = String(value ?? '').trim();

  const sanitized = raw
    .replace(/[^A-Za-z0-9:_-]/g, '')
    .slice(0, 128);

  return sanitized || null;
}

function sanitizeName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/<[^>]+>/g, ' ')
    .replace(
      /[^A-Za-zÀ-ÖØ-öø-ÿ0-9 .,'-]/g,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function sanitizeEmail(value) {
  const sanitized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9.!#$%&'*+/=?^_`{|}~@-]/g,
      '',
    )
    .slice(0, 254);

  if (!sanitized) {
    return '';
  }

  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(
    sanitized,
  )
    ? sanitized
    : '';
}

export function sanitizeSession(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    return null;
  }

  const token = sanitizeToken(value.token);
  const sourceUser = value.user;

  if (
    !sourceUser
    || typeof sourceUser !== 'object'
    || Array.isArray(sourceUser)
  ) {
    return null;
  }

  const role = String(
    sourceUser.role ?? '',
  ).toUpperCase();

  const id = sanitizeIdentifier(
    sourceUser.id ?? sourceUser.sub,
  );

  if (
    !token
    || !id
    || !ALLOWED_ROLES.has(role)
  ) {
    return null;
  }

  const email = sanitizeEmail(sourceUser.email);

  const name = sanitizeName(
    sourceUser.name
    || email
    || 'Usuario',
  );

  return {
    token,
    user: {
      id,
      name: name || 'Usuario',
      email,
      role,
    },
  };
}

export function readSession(
  storage = sessionStorage,
) {
  try {
    const raw = storage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const sanitized = sanitizeSession(
      JSON.parse(raw),
    );

    if (!sanitized) {
      storage.removeItem(SESSION_KEY);
      return null;
    }

    return sanitized;
  } catch {
    storage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSession(
  storage = sessionStorage,
  value,
) {
  const sanitized = sanitizeSession(value);

  if (!sanitized) {
    storage.removeItem(SESSION_KEY);

    throw new TypeError(
      'La sesión recibida no tiene un formato válido.',
    );
  }

  const serialized = JSON.stringify(sanitized);

  storage.setItem(
    SESSION_KEY,
    serialized,
  );

  return sanitized;
}

export function clearSession(
  storage = sessionStorage,
) {
  storage.removeItem(SESSION_KEY);
}
