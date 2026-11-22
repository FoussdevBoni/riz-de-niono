import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En développement, /api est relayé vers le backend : le client HTTP n'utilise que des chemins relatifs.
// API_PROXY permet de viser un autre backend local (par exemple celui de la base de tests sur un autre port).
// Variable lue sans dépendre des types Node, absents du frontend.
const environnement = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': environnement.API_PROXY ?? 'http://localhost:3000',
    },
  },
});
