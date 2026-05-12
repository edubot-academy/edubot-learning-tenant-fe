import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiLock } from 'react-icons/fi';
import { useAuth } from './AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { getPasswordSetupError } from './authPassword';

function getSetupErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return error instanceof Error
    ? error.message
    : 'This setup link is invalid or expired. Ask for a new invite link.';
}

export function SetupAccountPage() {
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
      setError('Setup token is missing. Ask your organization administrator for a new invite link.');
      return;
    }
    const passwordError = getPasswordSetupError(password, confirmPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    try {
      await completeSetup(token, password);
      toast.success('Account setup complete');
      navigate('/', { replace: true });
    } catch (setupError) {
      setError(getSetupErrorMessage(setupError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page landing-page">
      <section className="landing-hero" aria-label="Learning workspace account setup">
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
          <h1>Set up your account</h1>
          <p>Create a password for your organization workspace. You will use this email and password for future sign-ins.</p>
          {resolutionError ? <p className="field-error auth-error-banner">{resolutionError}</p> : null}
          {!token ? <p className="field-error auth-error-banner">Setup token is missing. Ask your organization administrator for a new invite link.</p> : null}
        </div>
        <div className="landing-proof-grid">
          <article>
            <FiLock />
            <strong>Secure access</strong>
            <span>Your invite link can only be used once.</span>
          </article>
          <article>
            <FiCheckCircle />
            <strong>Tenant ready</strong>
            <span>After setup, you will enter your assigned workspace.</span>
          </article>
        </div>
      </section>

      <form className="login-panel" onSubmit={onSubmit}>
        <div className="login-heading">
          <span>Account setup</span>
          <h2>{resolvedTenant ? `Join ${resolvedTenant.name}` : 'Join your workspace'}</h2>
          <p>Choose a password to activate your tenant account.</p>
        </div>
        <label>
          New password
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
            disabled={submitting || resolvingTenant || Boolean(resolutionError) || !token}
            required
          />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" disabled={submitting || resolvingTenant || Boolean(resolutionError) || !token}>
          {submitting ? 'Setting up...' : resolvingTenant ? 'Preparing workspace...' : 'Set up account'}
        </button>
        <p className="login-support-note">
          Already finished setup? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
