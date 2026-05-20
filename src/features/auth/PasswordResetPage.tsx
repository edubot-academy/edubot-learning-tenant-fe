import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiMail } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset, resetPassword } from '../../services/api';
import { getApiErrorMessage, getApiResponseMessage } from '../../lib/apiErrors';
import { useTenant } from '../tenant/TenantProvider';
import { getPasswordSetupError } from './authPassword';

type ResetStep = 'request' | 'reset';

export function PasswordResetPage() {
  const { t } = useTranslation();
  const { resolvedTenant, resolvingTenant, resolutionError } = useTenant();
  const [step, setStep] = useState<ResetStep>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (resolutionError) {
      setError(resolutionError);
      return;
    }
    if (!identifier.trim()) {
      setError(t('auth.useAssignedEmail'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await requestPasswordReset({ identifier: identifier.trim(), method: 'email' });
      setMessage(getApiResponseMessage(response, t('auth.resetCodeSent')));
      setStep('reset');
      toast.success(t('auth.resetCodeRequested'));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, t('auth.resetCodeRequestFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError(t('auth.emailRequired'));
      setStep('request');
      return;
    }
    if (!otp.trim()) {
      setError(t('auth.enterResetCode'));
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
      const response = await resetPassword({
        identifier: identifier.trim(),
        method: 'email',
        otp: otp.trim(),
        newPassword: password,
      });
      setMessage(getApiResponseMessage(response, t('auth.passwordResetCompleteDetail')));
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      toast.success(t('auth.passwordResetComplete'));
    } catch (resetError) {
      setError(getApiErrorMessage(resetError, t('auth.passwordResetFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page landing-page">
      <section className="landing-hero" aria-label={t('auth.resetPasswordTitle')}>
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
          <h1>{t('auth.resetPasswordTitle')}</h1>
          <p>{t('auth.resetPasswordDescription')}</p>
          {resolutionError ? <p className="field-error auth-error-banner">{resolutionError}</p> : null}
        </div>
        <div className="landing-proof-grid">
          <article>
            <FiMail />
            <strong>{t('auth.emailCode')}</strong>
            <span>{t('auth.emailCodeDetail')}</span>
          </article>
          <article>
            <FiCheckCircle />
            <strong>{t('auth.returnToClass')}</strong>
            <span>{t('auth.returnToClassDetail')}</span>
          </article>
        </div>
      </section>

      <form className="login-panel" onSubmit={step === 'request' ? submitRequest : submitReset}>
        <div className="login-heading">
          <span>{t('auth.passwordRecovery')}</span>
          <h2>{step === 'request' ? t('auth.requestResetCode') : t('auth.enterResetCode')}</h2>
          <p>{step === 'request' ? t('auth.useAssignedEmail') : t('auth.chooseNewPassword')}</p>
        </div>
        <label>
          {t('auth.email')}
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            type="email"
            autoComplete="email"
            disabled={submitting || step === 'reset'}
            aria-invalid={Boolean(error && step === 'request')}
            required
          />
        </label>
        {step === 'reset' ? (
          <>
            <label>
              {t('auth.resetCode')}
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-invalid={Boolean(error && !otp.trim())}
                required
              />
            </label>
            <label>
              {t('auth.newPassword')}
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={8}
                aria-invalid={Boolean(error && password.length < 8)}
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
                required
              />
            </label>
          </>
        ) : null}
        {message ? <p className="login-support-note">{message}</p> : null}
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" disabled={submitting || resolvingTenant || Boolean(resolutionError)}>
          {submitting ? t('auth.working') : step === 'request' ? t('auth.sendResetCode') : t('auth.resetPassword')}
        </button>
        {step === 'reset' ? (
          <button type="button" className="secondary-button" onClick={() => setStep('request')} disabled={submitting}>
            {t('auth.requestNewCode')}
          </button>
        ) : null}
        <p className="login-support-note">
          {t('auth.rememberedPassword')} <Link to="/login">{t('titles.signIn')}</Link>
        </p>
      </form>
    </main>
  );
}
