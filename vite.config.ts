import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    envPrefix: ['VITE_', 'SUPABASE_'],
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(
        (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://majiuodmywmnfssxzpcf.supabase.co')
          .trim()
          .replace(/\/rest\/v1\/?$/i, '')
          .replace(/\/+$/, '')
      ),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        'sb_publishable_8ZgZ0zS0ra4ejosOC4HIOQ_kdfU7fPU'
      ),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(
        (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://majiuodmywmnfssxzpcf.supabase.co')
          .trim()
          .replace(/\/rest\/v1\/?$/i, '')
          .replace(/\/+$/, '')
      ),
      'process.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        'sb_publishable_8ZgZ0zS0ra4ejosOC4HIOQ_kdfU7fPU'
      ),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
