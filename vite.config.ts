import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/auth/v1': {
          target: 'https://ecehblmmlzdkhvdfwsum.supabase.co',
          changeOrigin: true,
        },
        '/rest/v1': {
          target: 'https://ecehblmmlzdkhvdfwsum.supabase.co',
          changeOrigin: true,
        },
        '/realtime/v1': {
          target: 'https://ecehblmmlzdkhvdfwsum.supabase.co',
          changeOrigin: true,
          ws: true,
        },
        '/storage/v1': {
          target: 'https://ecehblmmlzdkhvdfwsum.supabase.co',
          changeOrigin: true,
        },
        '/functions/v1': {
          target: 'https://ecehblmmlzdkhvdfwsum.supabase.co',
          changeOrigin: true,
        },
      },
    },
  };
});
