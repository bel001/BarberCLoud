import { api, formData, requireAuth, setLoading, toast } from './app.js';

const session = requireAuth(['CLIENTE']);
const form = document.querySelector('#profile-form');

async function loadProfile() {
  if (!session) return;
  const user = await api('/client/me');
  form.name.value = user.name || '';
  form.email.value = user.email || '';
  form.phone.value = user.phone || '';
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading(form, true);
  try {
    const user = await api('/client/me', { method: 'PUT', body: formData(form) });
    const current = JSON.parse(localStorage.getItem('barbercloud_session'));
    current.user = user;
    localStorage.setItem('barbercloud_session', JSON.stringify(current));
    toast('Perfil actualizado');
  } catch (error) { toast(error.message, 'error'); }
  finally { setLoading(form, false); }
});

loadProfile().catch((error) => toast(error.message, 'error'));
