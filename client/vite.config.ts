import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CLIENT_PORT, SERVER_PORT } from '@quiz/shared';

const target = `http://localhost:${SERVER_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so phones on the same network can connect
    port: CLIENT_PORT,
    strictPort: true,
    allowedHosts: true, // allow tunnel hostnames (demo fallback)
    proxy: {
      '/api': target,
      '/socket.io': { target, ws: true },
    },
  },
});
