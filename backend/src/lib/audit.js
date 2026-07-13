import { randomUUID } from 'node:crypto';
import { putItem } from './repository.js';

export async function audit({ actorId = 'SYSTEM', actorRole = 'SYSTEM', action, resource, details = {} }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await putItem({
    PK: `AUDIT#${id}`,
    SK: 'META',
    GSI1PK: 'AUDIT',
    GSI1SK: createdAt,
    entityType: 'AUDIT',
    id,
    actorId,
    actorRole,
    action,
    resource,
    details,
    createdAt
  });
}
