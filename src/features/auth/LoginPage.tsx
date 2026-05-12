import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiUsers } from 'react-icons/fi';
import { useAuth } from './AuthProvider';
import { useTenant } from '../tenant/TenantProvider';

const proofPoints = [
  { icon: FiCalendar, label: 'Sessions', value: 'Schedules, links, materials' },
  { icon: FiCheckCircle, label: 'Daily operations', value: 'Attendance and homework queues' },
  { icon: FiAward, label: 'Achievements', value: 'Certificates and progress' },
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const { resolvedTenant, resolvingTenant, resolutionError } = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (resolutionError) {
      toast.error(resolutionError);
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page landing-page">
      <section className="landing-hero" aria-label="Learning workspace sign in">
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
          <h1>{resolvedTenant ? `Welcome to ${resolvedTenant.name}` : 'Sign in to your learning workspace'}</h1>
          <p>
            Manage classes, attendance, homework, certificates, and student progress in one workspace
            configured for your organization.
          </p>
          <p className="login-support-note">Powered by EduBot Learning.</p>
          {resolutionError ? <p className="field-error">{resolutionError}</p> : null}
        </div>
        <div className="landing-proof-grid">
          {proofPoints.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label}>
                <Icon />
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </article>
            );
          })}
        </div>
        <div className="product-preview" aria-hidden="true">
          <div className="preview-sidebar">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="preview-main">
            <div className="preview-header">
              <strong>Today</strong>
              <span>3 sessions</span>
            </div>
            <div className="preview-stat-row">
              <span><strong>92%</strong> attendance</span>
              <span><strong>18</strong> reviews</span>
              <span><strong>7</strong> certificates</span>
            </div>
            <div className="preview-list">
              <span><FiBookOpen /> English A2 · 10:00</span>
              <span><FiUsers /> Group B1 · homework queue</span>
              <span><FiAward /> Certificate approvals ready</span>
            </div>
          </div>
        </div>
      </section>

      <form className="login-panel" onSubmit={onSubmit}>
        <div className="login-heading">
          <span>Sign in</span>
          <h2>{resolvedTenant ? `Access ${resolvedTenant.name}` : 'Access your workspace'}</h2>
          <p>Use the account assigned by your organization administrator.</p>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={submitting || resolvingTenant || Boolean(resolutionError)}>
          {submitting ? 'Signing in...' : resolvingTenant ? 'Preparing workspace...' : 'Sign in'}
        </button>
        <p className="login-support-note">
          Forgot your password? <Link to="/forgot-password">Reset it</Link>
        </p>
        <p className="login-support-note">Need access? Ask your organization administrator to add you to this workspace.</p>
      </form>
    </main>
  );
}
