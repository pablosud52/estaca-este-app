import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Estaca Este App - Finanzas y Calendario',
        short_name: 'Estaca Este',
        description: 'Gestión presupuestaria y agenda de actividades de la Estaca Montevideo Uruguay Este',
        theme_color: '#072B52',
        background_color: '#051E3B',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['xlsx', 'chart.js', 'react-chartjs-2', 'lucide-react', '@supabase/supabase-js'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/lcr-calendar': {
        target: 'https://www.churchofjesuschrist.org',
        changeOrigin: true,
        rewrite: () =>
          '/church-calendar/services/ext/v3.0/export/ical/group/cd92d6817fa64d25bc2f55aec4fea180',
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
