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
import './styles/tenant-design-system.css';
import './styles/instructor-cockpit.css';
import './styles/instructor-cockpit-view.css';

ReactDOM.createRoot(document.querySelector('#root')!).render(
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
