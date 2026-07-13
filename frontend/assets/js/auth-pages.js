import { api, dashboardFor, formData, runtimeConfig, setLoading, storage, toast } from './app.js';

const base64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

async function createPkce() {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64Url(random);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(digest) };
}

async function redirectToCognito(screen = 'login') {
  const { verifier, challenge } = await createPkce();
  sessionStorage.setItem('barbercloud_pkce_verifier', verifier);
  const params = new URLSearchParams({
    client_id: runtimeConfig.cognito.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: runtimeConfig.cognito.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });
  if (screen === 'signup') params.set('screen_hint', 'signup');
  window.location.href = `${runtimeConfig.cognito.domain}/oauth2/authorize?${params}`;
}

const loginForm = document.querySelector('#login-form');
if (loginForm) {
  if (runtimeConfig.mode === 'aws') {
    loginForm.innerHTML = '<button class="btn btn-primary" type="submit">Ingresar con Amazon Cognito</button>';
  }
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (runtimeConfig.mode === 'aws') return redirectToCognito('login');
    setLoading(loginForm, true);
    try {
      const result = await api('/auth/login', { method: 'POST', body: formData(loginForm) });
      storage.session = result;
      const next = new URLSearchParams(location.search).get('next');
      window.location.href = next || dashboardFor(result.user.role);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(loginForm, false);
    }
  });
}

const registerForm = document.querySelector('#register-form');
if (registerForm) {
  if (runtimeConfig.mode === 'aws') {
    registerForm.innerHTML = '<p class="muted">Cognito gestionará el correo, la contraseña y la verificación de la cuenta.</p><button class="btn btn-primary" type="submit">Crear cuenta con Cognito</button>';
  }
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (runtimeConfig.mode === 'aws') return redirectToCognito('signup');
    setLoading(registerForm, true);
    try {
      const data = formData(registerForm);
      if (data.password !== data.confirmPassword) throw new Error('Las contraseñas no coinciden');
      delete data.confirmPassword;
      const result = await api('/auth/register', { method: 'POST', body: data });
      storage.session = result;
      window.location.href = 'cliente.html';
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(registerForm, false);
    }
  });
}
