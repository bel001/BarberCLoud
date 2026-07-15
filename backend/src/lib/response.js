export function ok(data, message = undefined) {
  return { ok: true, ...(message ? { message } : {}), data };
}

export function lambdaResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}
