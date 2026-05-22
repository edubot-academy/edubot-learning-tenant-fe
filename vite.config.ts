import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const hasPath = (id: string, path: string) => id.indexOf(path) !== -1;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (hasPath(id, '/node_modules/react/')
            || hasPath(id, '/node_modules/react-dom/')
            || hasPath(id, '/node_modules/react-router/')
            || hasPath(id, '/node_modules/react-router-dom/')) {
            return 'react';
          }
          if (hasPath(id, '/node_modules/i18next/') || hasPath(id, '/node_modules/react-i18next/')) {
            return 'i18n';
          }
          if (hasPath(id, '/node_modules/recharts/') || hasPath(id, '/node_modules/victory-vendor/')) {
            return 'charts';
          }
          if (hasPath(id, '/node_modules/react-icons/')) {
            return 'icons';
          }
          if (hasPath(id, '/node_modules/axios/')
            || hasPath(id, '/node_modules/clsx/')
            || hasPath(id, '/node_modules/react-hot-toast/')) {
            return 'vendor';
          }
          if (hasPath(id, '/src/i18n/locale.ts')) {
            return 'locale';
          }
          if (hasPath(id, '/src/i18n/config.ts') || hasPath(id, '/src/i18n/locales/')) {
            return 'app-i18n';
          }
          if (hasPath(id, '/src/services/authApi.ts')) {
            return 'auth-api';
          }
          if (hasPath(id, '/src/services/tenantApi.ts')) {
            return 'tenant-api';
          }
          if (hasPath(id, '/src/services/shellApi.ts')) {
            return 'shell-api';
          }
          if (hasPath(id, '/src/services/http.ts')) {
            return 'http';
          }
          if (hasPath(id, '/src/services/api.ts')) {
            return 'api';
          }
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
