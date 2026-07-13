export const runtimeConfig = {
  mode: 'local',
  api: {
    public: 'http://localhost:3001',
    reservation: 'http://localhost:3001',
    cancellation: 'http://localhost:3001',
    barber: 'http://localhost:3001',
    secretary: 'http://localhost:3001',
    admin: 'http://localhost:3001'
  },
  cognito: {
    domain: '',
    clientId: '',
    redirectUri: 'http://localhost:8080/callback.html',
    logoutUri: 'http://localhost:8080/index.html'
  }
};
