/**
 * Proxy del dev server hacia el backend online de staging (`npm run start:staging`).
 *
 * Staging responde 403 a cualquier request que traiga header `Origin` (su CORS no admite localhost),
 * y el navegador lo agrega en los POST/PUT/DELETE aunque sean same-origin. Por eso se quita `Origin`
 * (y `Referer`) antes de reenviar: para el backend, la llamada llega como server-to-server.
 */
const TARGET = 'https://tramitesmisiones.api.dev.stagemnes.net.ar';

module.exports = {
  '/api': {
    target: TARGET,
    secure: true,
    changeOrigin: true,
    logLevel: 'info',
    // Vite (builder `application` de Angular 17).
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
      });
    },
  },
};
