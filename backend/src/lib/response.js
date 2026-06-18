const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

export function ok(body) {
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
}

export function created(body) {
  return {
    statusCode: 201,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
}

export function badRequest(message) {
  return {
    statusCode: 400,
    headers: jsonHeaders,
    body: JSON.stringify({ error: message })
  };
}

export function serverError(error) {
  const statusCode = error.statusCode || 500;

  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify({
      error: statusCode === 500 ? "Error interno del servidor" : error.message
    })
  };
}
