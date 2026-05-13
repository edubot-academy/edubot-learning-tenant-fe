import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './features/auth/AuthProvider';
import { TenantProvider } from './features/tenant/TenantProvider';
import { ThemeProvider } from './features/theme/ThemeProvider';
import { LocaleProvider } from './i18n/LocaleProvider';
import { App } from './app/App';
import './i18n/config';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <TenantProvider>
            <LocaleProvider>
              <App />
              <Toaster position="top-right" />
            </LocaleProvider>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
