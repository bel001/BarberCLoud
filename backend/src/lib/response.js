const getAllowedOrigins = () => {
  const env = process.env.ENVIRONMENT || process.env.NODE_ENV || "dev";
  if (env === "dev" || env === "local") {
    return "*";
  }
  return process.env.ALLOWED_ORIGINS || "*";
};

const buildJsonHeaders = () => ({
  ...getAllowedOrigins() !== "*" ? {} : { "Access-Control-Allow-Origin": "*" },
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Content-Type": "application/json"
});

const getCorsHeaders = () => ({
  "Access-Control-Allow-Origin": getAllowedOrigins(),
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
});

export function ok(body) {
  return {
    statusCode: 200,
    headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function created(body) {
  return {
    statusCode: 201,
    headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function badRequest(message) {
  return {
    statusCode: 400,
    headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ error: message })
  };
}

export function serverError(error) {
  const statusCode = error.statusCode || (error.name === "TransactionCanceledException" ? 400 : 500);
  let message = error.message;

  if (statusCode === 500) {
    message = "Error interno del servidor";
  } else if (error.name === "TransactionCanceledException") {
    message = "La operacion no pudo completarse de forma consistente";
  }

  return {
    statusCode,
    headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ error: message })
  };
}