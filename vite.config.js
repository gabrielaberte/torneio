import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Placar Vôlei', short_name: 'Placar Vôlei',
        description: 'Gestão de torneios e placares de vôlei',
        theme_color: '#0f2a3d', background_color: '#ffffff',
        display: 'standalone', start_url: '/'
      },
      workbox: { navigateFallback: '/index.html' }
    })
  ]
});
