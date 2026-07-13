import { randomUUID } from 'node:crypto';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient
} from '@aws-sdk/client-cognito-identity-provider';
import { createToken, hashPassword } from '../lib/auth.js';
import { config, isAwsRuntime } from '../lib/config.js';
import { AppError, notFound } from '../lib/errors.js';
import { assertEmail, normalizeText, requireFields } from '../lib/validation.js';
import { getItem, putItem, scanByType, updateItem } from '../lib/repository.js';
import { audit } from '../lib/audit.js';

const cognito = new CognitoIdentityProviderClient({ region: config.region });

const publicUser = (user) => {
  if (!user) return null;
  const { passwordHash: _passwordHash, PK: _PK, SK: _SK, GSI1PK: _GSI1PK, GSI1SK: _GSI1SK, ...safe } = user;
  return safe;
};

const buildUser = ({ id, name, email, phone, role, password, specialties }) => ({
  PK: `USER#${id}`,
  SK: 'META',
  GSI1PK: `ROLE#${role}`,
  GSI1SK: normalizeText(name).toLowerCase(),
  entityType: 'USER',
  id,
  name: normalizeText(name),
  email: normalizeText(email).toLowerCase(),
  phone: normalizeText(phone),
  role,
  specialties: role === 'BARBERO' ? (specialties || []) : undefined,
  ...(password ? { passwordHash: hashPassword(password) } : {}),
  active: true,
  createdAt: new Date().toISOString()
});

async function createCognitoIdentity({ name, email, phone, role, temporaryPassword }) {
  const response = await cognito.send(new AdminCreateUserCommand({
    UserPoolId: config.userPoolId,
    Username: email,
    TemporaryPassword: temporaryPassword,
    DesiredDeliveryMediums: ['EMAIL'],
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: name },
      ...(phone ? [{ Name: 'phone_number', Value: phone.startsWith('+') ? phone : `+51${phone}` }] : [])
    ]
  }));
  await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: config.userPoolId, Username: email, GroupName: role }));
  return response.User?.Attributes?.find((item) => item.Name === 'sub')?.Value || response.User?.Username || randomUUID();
}

export async function findUserByEmail(email) {
  const users = await scanByType('USER');
  return users.find((user) => user.email.toLowerCase() === String(email).toLowerCase()) || null;
}

export async function login({ email, password }) {
  requireFields({ email, password }, ['email', 'password']);
  const user = await findUserByEmail(email);
  if (!user || user.passwordHash !== hashPassword(password) || user.active === false) {
    throw new AppError('Correo o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
  }
  return { token: createToken(user), user: publicUser(user) };
}

export async function registerClient(payload) {
  requireFields(payload, ['name', 'email', 'password', 'phone']);
  assertEmail(payload.email);
  if (String(payload.password).length < 8) throw new AppError('La contraseña debe tener al menos 8 caracteres', 422, 'VALIDATION_ERROR');
  if (await findUserByEmail(payload.email)) throw new AppError('Ya existe una cuenta con ese correo', 409, 'EMAIL_EXISTS');
  const id = randomUUID();
  const user = buildUser({ ...payload, id, role: 'CLIENTE', password: payload.password });
  await putItem(user);
  await audit({ actorId: id, actorRole: 'CLIENTE', action: 'REGISTER', resource: `USER#${id}` });
  return { token: createToken(user), user: publicUser(user) };
}

export async function createClientByStaff(payload, actor) {
  requireFields(payload, ['name', 'email', 'phone']);
  assertEmail(payload.email);
  if (await findUserByEmail(payload.email)) throw new AppError('Ya existe una cuenta con ese correo', 409, 'EMAIL_EXISTS');
  const temporaryPassword = payload.password || `Bc!${randomUUID().replaceAll('-', '').slice(0, 10)}9a`;
  const id = isAwsRuntime()
    ? await createCognitoIdentity({ ...payload, role: 'CLIENTE', temporaryPassword })
    : randomUUID();
  const user = buildUser({ ...payload, id, role: 'CLIENTE', password: isAwsRuntime() ? undefined : temporaryPassword });
  await putItem(user);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CREATE_CLIENT', resource: `USER#${id}` });
  return { user: publicUser(user), temporaryPassword };
}

export async function upsertCognitoClient({ id, name, email, phone }) {
  const current = await getItem(`USER#${id}`);
  if (current) return publicUser(current);
  const user = buildUser({ id, name: name || email, email, phone: phone || '', role: 'CLIENTE' });
  await putItem(user);
  await audit({ actorId: id, actorRole: 'CLIENTE', action: 'COGNITO_PROFILE_CREATED', resource: `USER#${id}` });
  return publicUser(user);
}

export async function getUser(id) {
  const user = await getItem(`USER#${id}`);
  if (!user) throw notFound('Usuario no encontrado');
  return publicUser(user);
}

export async function updateProfile(id, payload, actor) {
  const user = await getItem(`USER#${id}`);
  if (!user) throw notFound('Usuario no encontrado');
  const updates = {
    name: normalizeText(payload.name || user.name),
    phone: normalizeText(payload.phone || user.phone),
    updatedAt: new Date().toISOString()
  };
  if (isAwsRuntime()) {
    await cognito.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: config.userPoolId,
      Username: user.email,
      UserAttributes: [
        { Name: 'name', Value: updates.name },
        ...(updates.phone ? [{ Name: 'phone_number', Value: updates.phone.startsWith('+') ? updates.phone : `+51${updates.phone}` }] : [])
      ]
    }));
  }
  const updated = await updateItem(`USER#${id}`, updates);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'UPDATE_PROFILE', resource: `USER#${id}`, details: updates });
  return publicUser(updated);
}

export async function listUsers({ role, search } = {}) {
  let users = await scanByType('USER');
  if (role) users = users.filter((user) => user.role === role);
  if (search) {
    const term = String(search).toLowerCase();
    users = users.filter((user) => `${user.name} ${user.email} ${user.phone}`.toLowerCase().includes(term));
  }
  return users.map(publicUser).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createStaff(payload, actor) {
  requireFields(payload, ['name', 'email', 'phone', 'role']);
  assertEmail(payload.email);
  if (!['BARBERO', 'SECRETARIA', 'ADMIN'].includes(payload.role)) throw new AppError('Rol interno inválido', 422, 'VALIDATION_ERROR');
  if (await findUserByEmail(payload.email)) throw new AppError('El correo ya está registrado', 409, 'EMAIL_EXISTS');
  const temporaryPassword = payload.password || `Bc!${randomUUID().replaceAll('-', '').slice(0, 10)}9a`;
  const id = isAwsRuntime()
    ? await createCognitoIdentity({ ...payload, role: payload.role, temporaryPassword })
    : randomUUID();
  const user = buildUser({ ...payload, id, password: isAwsRuntime() ? undefined : temporaryPassword });
  await putItem(user);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'CREATE_STAFF', resource: `USER#${id}`, details: { role: user.role } });
  return { ...publicUser(user), temporaryPassword };
}

export async function updateStaff(id, payload, actor) {
  const current = await getItem(`USER#${id}`);
  if (!current) throw notFound('Personal no encontrado');
  const nextRole = payload.role || current.role;
  if (!['BARBERO', 'SECRETARIA', 'ADMIN'].includes(nextRole)) throw new AppError('Rol interno inválido', 422, 'VALIDATION_ERROR');
  const updates = {
    name: normalizeText(payload.name || current.name),
    phone: normalizeText(payload.phone || current.phone),
    role: nextRole,
    active: payload.active === undefined ? current.active : Boolean(payload.active),
    specialties: payload.specialties || current.specialties,
    updatedAt: new Date().toISOString()
  };
  if (isAwsRuntime()) {
    if (nextRole !== current.role) {
      await cognito.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: config.userPoolId, Username: current.email, GroupName: current.role }));
      await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: config.userPoolId, Username: current.email, GroupName: nextRole }));
    }
    await cognito.send(updates.active
      ? new AdminEnableUserCommand({ UserPoolId: config.userPoolId, Username: current.email })
      : new AdminDisableUserCommand({ UserPoolId: config.userPoolId, Username: current.email }));
  }
  const updated = await updateItem(`USER#${id}`, updates);
  await audit({ actorId: actor.sub, actorRole: actor.role, action: 'UPDATE_STAFF', resource: `USER#${id}`, details: updates });
  return publicUser(updated);
}
