import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiMail } from 'react-icons/fi';
import { requestPasswordReset, resetPassword } from '../../services/api';
import { useTenant } from '../tenant/TenantProvider';
import { getPasswordSetupError } from './authPassword';

type ResetStep = 'request' | 'reset';

function getApiErrorMessage(error: unknown, fallback: string) {
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

export function PasswordResetPage() {
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
      setError('Enter the email assigned to your workspace account.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await requestPasswordReset({ identifier: identifier.trim(), method: 'email' });
      setMessage(response.message || 'If the account exists, a reset code was sent.');
      setStep('reset');
      toast.success('Reset code requested');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not request a reset code.'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Email is required.');
      setStep('request');
      return;
    }
    if (!otp.trim()) {
      setError('Enter the reset code.');
      return;
    }
    const passwordError = getPasswordSetupError(password, confirmPassword);
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
      setMessage(response.message || 'Password reset complete. You can sign in with your new password.');
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      toast.success('Password reset complete');
    } catch (resetError) {
      setError(getApiErrorMessage(resetError, 'Could not reset password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page landing-page">
      <section className="landing-hero" aria-label="Learning workspace password reset">
        <div className="landing-brand-row">
          <div className={`landing-logo-mark ${resolvedTenant?.logoUrl ? 'has-logo' : ''}`}>
            {resolvedTenant?.logoUrl ? <img src={resolvedTenant.logoUrl} alt="" /> : 'L'}
          </div>
          <span>{resolvedTenant?.name ?? 'Learning workspace'}</span>
        </div>
        <div className="landing-copy">
          <span className="eyebrow">
            {resolvingTenant ? 'Preparing workspace' : resolvedTenant ? 'Private learning portal' : 'Learning portal'}
          </span>
          <h1>Reset your password</h1>
          <p>Request a reset code for your organization account, then choose a new password.</p>
          {resolutionError ? <p className="field-error auth-error-banner">{resolutionError}</p> : null}
        </div>
        <div className="landing-proof-grid">
          <article>
            <FiMail />
            <strong>Email code</strong>
            <span>Codes are sent to the account email on file.</span>
          </article>
          <article>
            <FiCheckCircle />
            <strong>Return to class</strong>
            <span>After reset, sign in to your tenant workspace.</span>
          </article>
        </div>
      </section>

      <form className="login-panel" onSubmit={step === 'request' ? submitRequest : submitReset}>
        <div className="login-heading">
          <span>Password recovery</span>
          <h2>{step === 'request' ? 'Request reset code' : 'Enter reset code'}</h2>
          <p>{step === 'request' ? 'Use the email assigned by your organization.' : 'Choose a new password for future sign-ins.'}</p>
        </div>
        <label>
          Email
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
              Reset code
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
              New password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                minLength={8}
                aria-invalid={Boolean(error && password.length < 8)}
                required
              />
              <span className="field-help">Use at least 8 characters.</span>
            </label>
            <label>
              Confirm password
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
          {submitting ? 'Working...' : step === 'request' ? 'Send reset code' : 'Reset password'}
        </button>
        {step === 'reset' ? (
          <button type="button" className="secondary-button" onClick={() => setStep('request')} disabled={submitting}>
            Request a new code
          </button>
        ) : null}
        <p className="login-support-note">
          Remembered your password? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
