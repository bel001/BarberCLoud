export function lambdaEvent({
  method = 'GET',
  rawPath = '/',
  body,
  pathParameters,
  queryStringParameters,
  user = {},
  role = 'CLIENTE',
  groups
} = {}) {
  const groupClaim = groups || role;
  return {
    rawPath,
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters,
    queryStringParameters,
    requestContext: {
      http: { method, path: rawPath },
      authorizer: {
        jwt: {
          claims: {
            sub: user.sub || 'cliente-demo',
            email: user.email || 'cliente@demo.local',
            name: user.name || 'Cliente Demo',
            role,
            'cognito:groups': groupClaim
          }
        }
      }
    }
  };
}

export function parseBody(response) {
  return JSON.parse(response.body);
}
