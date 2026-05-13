import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiUsers } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { LanguageMenu } from '../../components/LanguageMenu';

const edubotLearningUrl = 'https://learning.edubot.it.com';
const edubotLearningName = 'EduBot Learning';

function renderPoweredBy(text: string) {
  const [prefix, suffix] = text.split(edubotLearningName);
  if (suffix === undefined) return text;

  return (
    <>
      {prefix}
      <a className="brand-text-link" href={edubotLearningUrl} target="_blank" rel="noopener noreferrer">{edubotLearningName}</a>
      {suffix}
    </>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { user, signIn } = useAuth();
  const { resolvedTenant, resolvingTenant, resolutionError } = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const proofPoints = [
    { icon: FiCalendar, label: t('navigation.sessions'), value: t('auth.sessionsProof') },
    { icon: FiCheckCircle, label: t('auth.dailyOperations'), value: t('auth.dailyOperationsProof') },
    { icon: FiAward, label: t('auth.achievements'), value: t('auth.achievementsProof') },
  ];

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (resolutionError) {
      setErrorMessage(resolutionError);
      toast.error(resolutionError);
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.loginFailed');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page landing-page">
      <div className="login-utility">
        <LanguageMenu />
      </div>
      <section className="landing-hero" aria-label={t('auth.signInToWorkspace')}>
        <div className="landing-brand-row">
          <div className="landing-brand-main">
            <div className={`landing-logo-mark ${resolvedTenant?.logoUrl ? 'has-logo' : ''}`}>
              {resolvedTenant?.logoUrl ? <img src={resolvedTenant.logoUrl} alt="" /> : 'L'}
            </div>
            <span>{resolvedTenant?.name ?? t('app.defaultTenant')}</span>
          </div>
        </div>
        <div className="landing-copy">
          <span className="eyebrow">
            {resolvingTenant ? t('app.preparingWorkspace') : resolvedTenant ? t('auth.privatePortal') : t('auth.learningPortal')}
          </span>
          <h1>{resolvedTenant ? t('auth.welcomeTenant', { name: resolvedTenant.name }) : t('auth.signInToWorkspace')}</h1>
          <p>{t('auth.heroDescription')}</p>
          <p className="login-support-note">{renderPoweredBy(t('auth.poweredBy'))}</p>
          {resolutionError ? <p className="field-error auth-error-banner">{resolutionError}</p> : null}
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
              <strong>{t('auth.previewToday')}</strong>
              <span>{t('auth.previewSessions')}</span>
            </div>
            <div className="preview-stat-row">
              <span><strong>92%</strong> {t('navigation.attendance')}</span>
              <span><strong>18</strong> {t('auth.previewHomeworkReviews')}</span>
              <span><strong>7</strong> {t('auth.previewCertificateApprovals')}</span>
            </div>
            <div className="preview-list">
              <span><FiBookOpen /> {t('auth.previewCourseSample')} · 10:00 {t('navigation.sessions')}</span>
              <span><FiUsers /> {t('auth.previewGroupSample')} · {t('auth.previewHomeworkQueue')}</span>
              <span><FiAward /> {t('auth.previewCertificateApprovalsReady')}</span>
            </div>
          </div>
        </div>
      </section>

      <form className="login-panel" onSubmit={onSubmit}>
        <div className="login-heading">
          <span>{t('titles.signIn')}</span>
          <h2>{resolvedTenant ? t('auth.accessTenant', { name: resolvedTenant.name }) : t('auth.accessWorkspace')}</h2>
          <p>{t('auth.signInDescription')}</p>
        </div>
        <label>
          {t('auth.email')}
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            disabled={submitting || resolvingTenant || Boolean(resolutionError)}
            aria-invalid={Boolean(errorMessage)}
            required
          />
        </label>
        <label>
          {t('auth.password')}
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            disabled={submitting || resolvingTenant || Boolean(resolutionError)}
            aria-invalid={Boolean(errorMessage)}
            required
          />
        </label>
        {errorMessage ? <p className="field-error">{errorMessage}</p> : null}
        <button type="submit" disabled={submitting || resolvingTenant || Boolean(resolutionError)}>
          {submitting ? t('auth.signingIn') : resolvingTenant ? t('app.preparingWorkspace') : t('titles.signIn')}
        </button>
        <p className="login-support-note">
          {t('auth.forgotPassword')} <Link to="/forgot-password">{t('auth.resetPassword')}</Link>
        </p>
        <p className="login-support-note">{t('auth.needAccess')}</p>
      </form>
    </main>
  );
}
