export const OAUTH_TRANSACTION_KEY = 'barbercloud_oauth_transaction';
export const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;

const base64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replaceAll('=', '');

const randomToken = (cryptoApi) => base64Url(cryptoApi.getRandomValues(new Uint8Array(32)));

export async function createOAuthTransaction({
  storage = sessionStorage,
  cryptoApi = crypto,
  now = Date.now()
} = {}) {
  const verifier = randomToken(cryptoApi);
  const state = randomToken(cryptoApi);
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const transaction = { verifier, state, createdAt: now };
  storage.setItem(OAUTH_TRANSACTION_KEY, JSON.stringify(transaction));
  return { ...transaction, challenge: base64Url(digest) };
}

export function consumeOAuthTransaction(returnedState, {
  storage = sessionStorage,
  now = Date.now()
} = {}) {
  const rawTransaction = storage.getItem(OAUTH_TRANSACTION_KEY);
  storage.removeItem(OAUTH_TRANSACTION_KEY);

  if (!rawTransaction || !returnedState) {
    throw new Error('La sesión de autenticación no existe. Inicia sesión nuevamente.');
  }

  let transaction;
  try {
    transaction = JSON.parse(rawTransaction);
  } catch {
    throw new Error('La sesión de autenticación no es válida. Inicia sesión nuevamente.');
  }

  if (!transaction.verifier || !transaction.state || transaction.state !== returnedState) {
    throw new Error('El estado de autenticación no coincide. Inicia sesión nuevamente.');
  }

  if (!Number.isFinite(transaction.createdAt) || now - transaction.createdAt > OAUTH_TRANSACTION_TTL_MS) {
    throw new Error('La sesión de autenticación venció. Inicia sesión nuevamente.');
  }

  return transaction;
}
