import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          i18n: ['i18next', 'react-i18next'],
          icons: ['react-icons/fi'],
          vendor: ['axios', 'clsx', 'react-hot-toast'],
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
