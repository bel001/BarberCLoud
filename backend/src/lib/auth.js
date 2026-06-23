export function getClaims(event) {
  return event?.requestContext?.authorizer?.jwt?.claims || event?.requestContext?.authorizer?.claims || {};
}

export function getGroups(event) {
  const claims = getClaims(event);
  const groups = claims["cognito:groups"] || claims.role;

  if (!groups) return [];
  if (Array.isArray(groups)) return groups;

  return String(groups)
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map(group => group.trim());
}

export function hasRole(event, allowedRoles) {
  const groups = getGroups(event);
  return groups.some(group => allowedRoles.includes(group));
}

export function requireRole(event, allowedRoles) {
  if (!hasRole(event, allowedRoles)) {
    const error = new Error("Acceso no autorizado");
    error.statusCode = 403;
    throw error;
  }
}

export function getUser(event) {
  const claims = getClaims(event);

  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name || claims.email || "Usuario"
  };
}
