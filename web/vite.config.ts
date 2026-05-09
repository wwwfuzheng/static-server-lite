import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, '..', '');
  const serverPort = rootEnv.PORT || '3000';
  return {
    plugins: [react()],
    base: '/admin/',
    build: {
      outDir: 'dist',
    },
    define: {
      'import.meta.env.VITE_SERVER_PORT': JSON.stringify(serverPort),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': `http://localhost:${serverPort}`,
      },
    },
  };
});
