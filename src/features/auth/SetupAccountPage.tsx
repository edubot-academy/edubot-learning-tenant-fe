import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiLock } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { getPasswordSetupError } from './authPassword';

function getSetupErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function SetupAccountPage() {
  const { t } = useTranslation();
  const { completeSetup } = useAuth();
  const { resolvedTenant, resolvingTenant, resolutionError } = useTenant();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (resolutionError) {
      setError(resolutionError);
      return;
    }
    if (!token) {
      setError(t('auth.setupMissing'));
      return;
    }
    const passwordError = getPasswordSetupError(password, confirmPassword, {
      minLength: t('auth.passwordMinError'),
      mismatch: t('auth.passwordMismatch'),
    });
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      await completeSetup(token, password);
      toast.success(t('auth.accountSetupComplete'));
      navigate('/', { replace: true });
    } catch (setupError) {
      setError(getSetupErrorMessage(setupError, t('auth.setupInvalid')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page landing-page">
      <section className="landing-hero" aria-label={t('auth.accountSetupTitle')}>
        <div className="landing-brand-row">
          <div className={`landing-logo-mark ${resolvedTenant?.logoUrl ? 'has-logo' : ''}`}>
            {resolvedTenant?.logoUrl ? <img src={resolvedTenant.logoUrl} alt="" /> : 'L'}
          </div>
          <span>{resolvedTenant?.name ?? t('app.defaultTenant')}</span>
        </div>
        <div className="landing-copy">
          <span className="eyebrow">
            {resolvingTenant ? t('app.preparingWorkspace') : resolvedTenant ? t('auth.privatePortal') : t('auth.learningPortal')}
          </span>
          <h1>{t('auth.accountSetupTitle')}</h1>
          <p>{t('auth.choosePassword')}</p>
          {resolutionError ? <p className="field-error auth-error-banner">{resolutionError}</p> : null}
          {!token ? <p className="field-error auth-error-banner">{t('auth.setupMissing')}</p> : null}
        </div>
        <div className="landing-proof-grid">
          <article>
            <FiLock />
            <strong>{t('auth.secureAccess')}</strong>
            <span>{t('auth.secureAccessDetail')}</span>
          </article>
          <article>
            <FiCheckCircle />
            <strong>{t('auth.tenantReady')}</strong>
            <span>{t('auth.tenantReadyDetail')}</span>
          </article>
        </div>
      </section>

      <form className="login-panel" onSubmit={onSubmit}>
        <div className="login-heading">
          <span>{t('auth.accountSetupEyebrow')}</span>
          <h2>{resolvedTenant ? t('auth.joinTenant', { name: resolvedTenant.name }) : t('auth.joinWorkspace')}</h2>
          <p>{t('auth.choosePassword')}</p>
        </div>
        <label>
          {t('auth.newPassword')}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            aria-invalid={Boolean(error && password.length < 8)}
            disabled={submitting || resolvingTenant || Boolean(resolutionError) || !token}
            required
          />
          <span className="field-help">{t('auth.passwordMinHelp')}</span>
        </label>
        <label>
          {t('auth.confirmPassword')}
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            aria-invalid={Boolean(error && password !== confirmPassword)}
            disabled={submitting || resolvingTenant || Boolean(resolutionError) || !token}
            required
          />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" disabled={submitting || resolvingTenant || Boolean(resolutionError) || !token}>
          {submitting ? t('auth.settingUp') : resolvingTenant ? t('app.preparingWorkspace') : t('auth.setupSubmit')}
        </button>
        <p className="login-support-note">
          {t('auth.alreadyFinished')} <Link to="/login">{t('titles.signIn')}</Link>
        </p>
      </form>
    </main>
  );
}
