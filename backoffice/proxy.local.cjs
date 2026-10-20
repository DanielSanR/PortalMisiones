/** Proxy del dev server hacia el backend local en Docker (`npm run start:local`). */
module.exports = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    logLevel: 'info',
  },
};
