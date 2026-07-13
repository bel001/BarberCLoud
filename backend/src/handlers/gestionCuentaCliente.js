import { eventMethod, parseBody, requireEventRole, wrap } from '../lib/lambda.js';
import { getUser, updateProfile } from '../services/user-service.js';

export const handler = wrap((event) => {
  const user = requireEventRole(event, 'CLIENTE');
  return eventMethod(event) === 'PUT'
    ? updateProfile(user.sub, parseBody(event), user)
    : getUser(user.sub);
});
