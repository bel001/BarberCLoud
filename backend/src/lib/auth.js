import crypto from 'node:crypto';
import { config } from './config.js';
import { forbidden, unauthorized } from './errors.js';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

export function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

export function createToken(user, expiresInSeconds = 60 * 60 * 8) {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };
  const encoded = encode(payload);
  const signature = crypto.createHmac('sha256', config.authSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) throw unauthorized();
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', config.authSecret).update(encoded).digest('base64url');
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) throw unauthorized('Sesión inválida');
  const payload = decode(encoded);
  if (payload.exp < Math.floor(Date.now() / 1000)) throw unauthorized('La sesión expiró');
  return payload;
}

export function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    req.user = verifyToken(header.replace(/^Bearer\s+/i, ''));
    next();
  } catch (error) {
    next(error);
  }
}

const permissions = {
  CLIENTE: ['CLIENTE'],
  BARBERO: ['BARBERO', 'ADMIN'],
  SECRETARIA: ['SECRETARIA', 'ADMIN'],
  ADMIN: ['ADMIN']
};

export function allow(...roles) {
  return (req, _res, next) => {
    const allowed = roles.flatMap((role) => permissions[role] || [role]);
    if (!req.user || !allowed.includes(req.user.role)) return next(forbidden());
    next();
  };
}
