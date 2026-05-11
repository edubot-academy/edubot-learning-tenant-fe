import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiUsers } from 'react-icons/fi';
import { useAuth } from './AuthProvider';

const proofPoints = [
  { icon: FiCalendar, label: 'Live and offline sessions', value: 'Schedule, links, materials' },
  { icon: FiCheckCircle, label: 'Attendance and homework', value: 'Daily queues in one place' },
  { icon: FiAward, label: 'Certificates', value: 'Brand, approve, issue' },
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
      <section className="landing-hero" aria-label="EduBot Learning platform overview">
        <div className="landing-brand-row">
          <div className="landing-logo-mark">E</div>
          <span>EduBot Learning</span>
        </div>
        <div className="landing-copy">
          <span className="eyebrow">Tenant workspace</span>
          <h1>Run every learning operation from one calm workspace.</h1>
          <p>
            EduBot Learning gives schools and course centers a focused tenant portal for sessions,
            attendance, homework, certificates, and student progress.
          </p>
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
          <h2>Access your tenant</h2>
          <p>Use the account assigned by your EduBot Learning platform administrator.</p>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
        <p className="login-support-note">Need access? Ask your platform administrator to add you to a tenant.</p>
      </form>
    </main>
  );
}
