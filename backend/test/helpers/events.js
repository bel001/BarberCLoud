export function lambdaEvent({
  method = "GET",
  rawPath = "/",
  body,
  pathParameters,
  queryStringParameters,
  user = {},
  role = "CLIENTE"
} = {}) {
  return {
    rawPath,
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters,
    queryStringParameters,
    requestContext: {
      http: { method },
      authorizer: {
        jwt: {
          claims: {
            sub: user.sub || "cliente-demo",
            email: user.email || "cliente@demo.local",
            name: user.name || "Cliente Demo",
            role
          }
        }
      }
    }
  };
}

export function parseBody(response) {
  return JSON.parse(response.body);
}
