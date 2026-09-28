import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // em desenvolvimento, /api vai para o backend na porta 8080
    proxy: { '/api': 'http://localhost:8080' },
  },
});
