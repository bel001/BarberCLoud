import { cognitoRole, dashboardFor, decodeJwt, runtimeConfig, storage } from './app.js';
import { consumeOAuthTransaction } from './oauth-transaction.js';

const status = document.querySelector('#callback-status');

async function completeLogin() {
  if (runtimeConfig.mode !== 'aws') {
    status.textContent = 'El callback de Cognito solo se utiliza después del despliegue AWS.';
    return;
  }
  const params = new URLSearchParams(location.search);
  const transaction = consumeOAuthTransaction(params.get('state'));
  if (params.get('error')) throw new Error(params.get('error_description') || params.get('error'));
  const code = params.get('code');
  if (!code) throw new Error('No se encontró el código de Cognito. Inicia sesión nuevamente.');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: runtimeConfig.cognito.clientId,
    code,
    redirect_uri: runtimeConfig.cognito.redirectUri,
    code_verifier: transaction.verifier
  });
  const response = await fetch(`${runtimeConfig.cognito.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const tokens = await response.json();
  if (!response.ok) throw new Error(tokens.error_description || 'Cognito no pudo completar el inicio de sesión');
  const claims = decodeJwt(tokens.id_token);
  const user = {
    id: claims.sub,
    name: claims.name || claims.email,
    email: claims.email,
    role: cognitoRole(claims)
  };
  storage.session = {
    token: tokens.access_token,
    user
  };
  window.location.replace(dashboardFor(user.role));
}

completeLogin().catch((error) => {
  status.textContent = error.message;
  status.classList.add('text-danger');
});
