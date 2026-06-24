import { v4 as uuid } from "uuid";
import { getPrimaryRole, getUser } from "./auth.js";
import { putItem } from "./dynamodb.js";

export async function audit(event, action, status, detail = {}) {
  const user = getUser(event);
  const role = getPrimaryRole(event);
  const now = new Date().toISOString();

  await putItem({
    pk: `AUDIT#${now.slice(0, 10)}`,
    sk: `${now}#${uuid()}`,
    gsi1pk: `AUDIT_USER#${user.sub || user.email || "system"}`,
    gsi1sk: now,
    tipo: "AUDIT_LOG",
    action,
    status,
    responsable: user.email || "system",
    usuarioId: user.sub || "system",
    rol: role,
    detail,
    creadoEn: now
  });
}
