import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';
import { CountFilterRow } from '../../components/CountFilterRow';
import {
  approveCertificate,
  getCertificateBranding,
  getCourseCertificateSettings,
  issueCourseCertificate,
  listCourseCertificates,
  listTenantCourses,
  previewCourseCertificate,
  regenerateCourseCertificates,
  rejectCertificate,
  revokeCertificate,
  searchUsers,
  updateCertificateBranding,
  updateCourseCertificateSettings,
  uploadCertificateLogo,
  uploadCourseCertificateSignature,
} from '../../services/api';
import type { CertificateBranding, Course, CourseCertificate, CourseCertificateSettings, UserSummary } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate } from '../../lib/format';
import { useAuth } from '../auth/AuthProvider';
import { canManageTenantCertificates, isTenantAdmin } from '../tenant/tenantRoles';

type CertificateDecision = {
  certificate: CourseCertificate;
  action: 'approve' | 'reject' | 'revoke';
};

type CertificateTab = 'branding' | 'rules' | 'registry';

const certificateTabs: Array<{ key: CertificateTab; label: string; description: string }> = [
  { key: 'branding', label: 'Branding', description: 'Certificate template, logo, colors, and preview.' },
  { key: 'rules', label: 'Course rules', description: 'Eligibility, issue mode, approval, and signatures.' },
  { key: 'registry', label: 'Registry', description: 'Issue, approve, regenerate, and search certificates.' },
];

export function CertificatesPage() {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const canManageCertificateAdmin = isTenantAdmin(user, activeTenant);
  const canManageCertificateRegistry = canManageTenantCertificates(user, activeTenant);
  const [branding, setBranding] = useState<CertificateBranding | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [courseSettings, setCourseSettings] = useState<CourseCertificateSettings | null>(null);
  const [certificates, setCertificates] = useState<CourseCertificate[]>([]);
  const [certificateQuery, setCertificateQuery] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<UserSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>();
  const [certificateNote, setCertificateNote] = useState('');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({});
  const [brandingErrors, setBrandingErrors] = useState<Record<string, string>>({});
  const [courseSettingsErrors, setCourseSettingsErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courseLoading, setCourseLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [decisionId, setDecisionId] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<CertificateDecision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [certificateTab, setCertificateTab] = useState<CertificateTab>('branding');
  const visibleCertificateTabs = useMemo(
    () => canManageCertificateAdmin ? certificateTabs : certificateTabs.filter((tab) => tab.key === 'registry'),
    [canManageCertificateAdmin],
  );

  useEffect(() => {
    if (!canManageCertificateAdmin && certificateTab !== 'registry') {
      setCertificateTab('registry');
    }
  }, [canManageCertificateAdmin, certificateTab]);

  useEffect(() => {
    setBranding(null);
    setCourses([]);
    setCourseId(undefined);
    setCourseSettings(null);
    setCertificates([]);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getCertificateBranding(activeTenantId), listTenantCourses(activeTenantId)])
      .then(([nextBranding, nextCourses]) => {
        if (cancelled) return;
        setBranding(nextBranding);
        setCourses(nextCourses);
        setCourseId(nextCourses[0]?.id);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load certificate branding');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  useEffect(() => {
    setCourseSettings(null);
    setCertificates([]);
    setCertificateQuery('');
    setCertificateStatus('all');
    if (!courseId) return;
    let cancelled = false;
    setCourseLoading(true);
    Promise.all([getCourseCertificateSettings(courseId), listCourseCertificates(courseId)])
      .then(([nextSettings, nextCertificates]) => {
        if (cancelled) return;
        setCourseSettings(nextSettings);
        setCertificates(nextCertificates);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error?.response?.data?.message || 'Could not load course certificate settings';
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setCourseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const preview = useMemo(() => ({
    brandName: branding?.primaryBrandName || activeTenant?.name || 'Tenant name',
    logoUrl: branding?.primaryBrandLogoUrl || activeTenant?.logoUrl || null,
    title: branding?.certificateTitle || 'Certificate of Completion',
    issuerName: branding?.issuerDisplayName || activeTenant?.name || 'Issuer name',
    issuerTitle: branding?.issuerTitle || 'Instructor',
    primaryColor: branding?.primaryColor || '#122144',
    accentColor: branding?.accentColor || '#f17e22',
    language: branding?.certificateLanguage || 'default',
    orientation: branding?.pageOrientation || 'landscape',
  }), [activeTenant?.logoUrl, activeTenant?.name, branding]);

  const certificateStatuses = useMemo(() => {
    const statuses = Array.from(new Set(certificates.map((certificate) => certificate.status).filter(Boolean)));
    return ['all', ...statuses];
  }, [certificates]);

  const certificateCounts = useMemo(() => (
    certificates.reduce<Record<string, number>>((acc, certificate) => {
      acc.total = (acc.total ?? 0) + 1;
      acc[certificate.status] = (acc[certificate.status] ?? 0) + 1;
      return acc;
    }, { total: 0 })
  ), [certificates]);

  const filteredCertificates = useMemo(() => {
    const normalizedQuery = certificateQuery.trim().toLowerCase();
    return certificates.filter((certificate) => {
      const matchesStatus = certificateStatus === 'all' || certificate.status === certificateStatus;
      const matchesQuery = !normalizedQuery
        || String(certificate.studentName ?? '').toLowerCase().includes(normalizedQuery)
        || String(certificate.studentId).includes(normalizedQuery)
        || String(certificate.publicId ?? '').toLowerCase().includes(normalizedQuery)
        || String(certificate.status ?? '').toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [certificateQuery, certificateStatus, certificates]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenant || !branding) return;
    const hexColorPattern = /^#?[0-9a-fA-F]{6}$/;
    const nextErrors: Record<string, string> = {};
    if (branding.primaryColor && !hexColorPattern.test(branding.primaryColor)) {
      nextErrors.primaryColor = 'Use a 6-digit hex color, for example #122144.';
    }
    if (branding.accentColor && !hexColorPattern.test(branding.accentColor)) {
      nextErrors.accentColor = 'Use a 6-digit hex color, for example #f17e22.';
    }
    if (Object.keys(nextErrors).length) {
      setBrandingErrors(nextErrors);
      toast.error(nextErrors.primaryColor ?? nextErrors.accentColor);
      return;
    }

    setBrandingErrors({});
    setSaving(true);
    try {
      const saved = await updateCertificateBranding(activeTenant.id, branding);
      setBranding(saved);
      toast.success('Certificate branding saved');
    } catch {
      toast.error('Could not save certificate branding');
    } finally {
      setSaving(false);
    }
  };

  const onLogoChange = async (file?: File) => {
    if (!activeTenant || !file) return;
    setSaving(true);
    try {
      const saved = await uploadCertificateLogo(activeTenant.id, file);
      setBranding(saved);
      toast.success('Logo uploaded');
    } catch {
      toast.error('Could not upload logo');
    } finally {
      setSaving(false);
    }
  };

  const saveCourseSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseId || !courseSettings) return;
    const nextErrors: Record<string, string> = {};
    const attendancePercent = courseSettings.eligibilityAttendancePercent ?? 80;
    const homeworkPercent = courseSettings.eligibilityHomeworkPercent ?? 100;
    if (attendancePercent < 0 || attendancePercent > 100) {
      nextErrors.attendance = 'Attendance must be between 0 and 100.';
    }
    if (homeworkPercent < 0 || homeworkPercent > 100) {
      nextErrors.homework = 'Homework must be between 0 and 100.';
    }
    if (Object.keys(nextErrors).length) {
      setCourseSettingsErrors(nextErrors);
      toast.error(nextErrors.attendance ?? nextErrors.homework);
      return;
    }

    setCourseSettingsErrors({});
    setSaving(true);
    try {
      const saved = await updateCourseCertificateSettings(courseId, courseSettings);
      setCourseSettings(saved);
      toast.success('Course certificate settings saved');
    } catch {
      toast.error('Could not save course certificate settings');
    } finally {
      setSaving(false);
    }
  };

  const openBackendPreview = async () => {
    if (!courseId || !courseSettings || !branding) return;
    setPreviewing(true);
    try {
      const html = await previewCourseCertificate(courseId, {
        ...courseSettings,
        previewStudentName: 'Student Name',
        previewCourseTitle: courses.find((course) => course.id === courseId)?.title ?? 'Course Title',
        previewIssuerName: branding.issuerDisplayName || activeTenant?.name || 'Issuer name',
        previewIssuerTitle: branding.issuerTitle || 'Instructor',
      });
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('Could not open certificate preview');
    } finally {
      setPreviewing(false);
    }
  };

  const uploadSignature = async (file?: File) => {
    if (!courseId || !file) {
      setCourseSettingsErrors((current) => ({ ...current, signature: 'Choose a signature image to upload.' }));
      toast.error('Choose a signature image to upload');
      return;
    }
    setCourseSettingsErrors((current) => ({ ...current, signature: '' }));
    setSaving(true);
    try {
      const saved = await uploadCourseCertificateSignature(courseId, file);
      setCourseSettings(saved);
      toast.success('Signature uploaded');
    } catch {
      toast.error('Could not upload signature');
    } finally {
      setSaving(false);
    }
  };

  const reloadCourseCertificates = async (nextCourseId = courseId) => {
    if (!nextCourseId) return;
    const rows = await listCourseCertificates(nextCourseId);
    setCertificates(rows);
  };

  const runStudentSearch = async () => {
    setIssuing(true);
    try {
      const results = await searchUsers({ search: studentSearch, role: 'student', limit: 12 });
      setStudentResults(results);
      setSelectedStudentId(results[0]?.id);
    } catch {
      toast.error('Could not search students');
    } finally {
      setIssuing(false);
    }
  };

  const issueCertificate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!courseId || !selectedStudentId || !branding) {
      nextErrors.student = 'Select a student before issuing a certificate.';
    }
    if (Object.keys(nextErrors).length) {
      setIssueErrors(nextErrors);
      toast.error(nextErrors.student);
      return;
    }

    setIssueErrors({});
    const activeCourseId = courseId!;
    const selectedStudent = selectedStudentId!;
    const activeBranding = branding!;
    const student = studentResults.find((item) => item.id === selectedStudent);
    setIssuing(true);
    try {
      await issueCourseCertificate(activeCourseId, {
        studentId: selectedStudent,
        studentFullName: student?.fullName,
        issuerDisplayName: activeBranding.issuerDisplayName ?? undefined,
        issuerTitle: activeBranding.issuerTitle ?? undefined,
        certificateLanguage: activeBranding.certificateLanguage === 'en' || activeBranding.certificateLanguage === 'ru' || activeBranding.certificateLanguage === 'ky'
          ? activeBranding.certificateLanguage
          : undefined,
        pageOrientation: activeBranding.pageOrientation === 'landscape' || activeBranding.pageOrientation === 'portrait'
          ? activeBranding.pageOrientation
          : undefined,
        note: certificateNote.trim() || undefined,
      });
      await reloadCourseCertificates(courseId);
      setCertificateNote('');
      setStudentSearch('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      setIsIssueModalOpen(false);
      setIssueErrors({});
      toast.success('Certificate issued');
    } catch {
      toast.error('Could not issue certificate');
    } finally {
      setIssuing(false);
    }
  };

  const certificateDecisionPayload = (): {
    issuerDisplayName?: string;
    issuerTitle?: string;
    certificateLanguage?: 'en' | 'ru' | 'ky';
    pageOrientation?: 'landscape' | 'portrait';
  } => {
    const certificateLanguage = branding?.certificateLanguage;
    const pageOrientation = branding?.pageOrientation;
    return {
      issuerDisplayName: branding?.issuerDisplayName ?? undefined,
      issuerTitle: branding?.issuerTitle ?? undefined,
      certificateLanguage: certificateLanguage === 'en' || certificateLanguage === 'ru' || certificateLanguage === 'ky'
        ? certificateLanguage
        : undefined,
      pageOrientation: pageOrientation === 'landscape' || pageOrientation === 'portrait'
        ? pageOrientation
        : undefined,
    };
  };

  const openCertificateDecision = (certificate: CourseCertificate, action: 'approve' | 'reject' | 'revoke') => {
    setPendingDecision({ certificate, action });
    setDecisionReason('');
  };

  const handleCertificateDecision = async () => {
    if (!pendingDecision) return;
    if (!courseId) return;

    const { certificate, action } = pendingDecision;
    const reason = decisionReason.trim() || undefined;

    if ((action === 'reject' || action === 'revoke') && !reason) {
      toast.error('Reason is required');
      return;
    }

    setDecisionId(certificate.id);
    try {
      if (action === 'approve') {
        await approveCertificate(certificate.id, certificateDecisionPayload());
      } else if (action === 'reject') {
        await rejectCertificate(certificate.id, reason);
      } else {
        await revokeCertificate(certificate.id, reason);
      }
      await reloadCourseCertificates(courseId);
      toast.success(`Certificate ${action}d`);
      setPendingDecision(null);
      setDecisionReason('');
    } catch {
      toast.error(`Could not ${action} certificate`);
    } finally {
      setDecisionId(null);
    }
  };

  const regenerateIssuedCertificates = async (certificateId?: number) => {
    if (!courseId) return;
    setRegenerating(true);
    try {
      const result = await regenerateCourseCertificates(courseId, certificateId);
      await reloadCourseCertificates(courseId);
      toast.success(`Regenerated ${result.regeneratedCount} certificate${result.regeneratedCount === 1 ? '' : 's'}`);
    } catch {
      toast.error('Could not regenerate certificates');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <LoadingState label="Loading certificate branding" />;
  if (!branding) return <EmptyState title="Certificate branding unavailable" />;

  return (
    <>
      <PageHeader
        title="Certificates"
        eyebrow={activeTenant?.name}
        actions={certificateTab === 'branding' && canManageCertificateAdmin ? <button type="submit" form="certificate-branding-form" disabled={saving}>{saving ? 'Saving...' : 'Save branding'}</button> : null}
      />
      <WorkspaceTabs
        tabs={visibleCertificateTabs}
        activeTab={certificateTab}
        onChange={setCertificateTab}
        ariaLabel="Certificate workspace"
        className="certificate-workspace-tabs"
      />
      {certificateTab === 'branding' ? (
      <div className="workspace-grid certificate-workspace">
        <form id="certificate-branding-form" className="settings-grid certificate-settings-grid" onSubmit={onSubmit}>
          <section className="settings-panel">
            <h2>Primary brand</h2>
            <label>
              Name on certificate
              <input disabled={!canManageCertificateAdmin} value={branding.primaryBrandName ?? ''} onChange={(event) => setBranding({ ...branding, primaryBrandName: event.target.value })} placeholder={activeTenant?.name ?? 'Tenant name'} />
            </label>
            <label>
              Certificate title
              <input disabled={!canManageCertificateAdmin} value={branding.certificateTitle ?? ''} onChange={(event) => setBranding({ ...branding, certificateTitle: event.target.value })} placeholder="Certificate of Completion" />
            </label>
            <label>
              Issuer name
              <input disabled={!canManageCertificateAdmin} value={branding.issuerDisplayName ?? ''} onChange={(event) => setBranding({ ...branding, issuerDisplayName: event.target.value })} placeholder={activeTenant?.name ?? 'Issuer name'} />
            </label>
            <label>
              Issuer title
              <input disabled={!canManageCertificateAdmin} value={branding.issuerTitle ?? ''} onChange={(event) => setBranding({ ...branding, issuerTitle: event.target.value })} placeholder="Instructor" />
            </label>
          </section>

          <section className="settings-panel">
            <h2>Logo and style</h2>
            <div className="logo-preview">
              {preview.logoUrl ? <img src={preview.logoUrl} alt="" /> : <span>No logo</span>}
            </div>
            <label>
              Upload logo
              <input disabled={!canManageCertificateAdmin} type="file" accept="image/*" onChange={(event) => void onLogoChange(event.target.files?.[0])} />
            </label>
            <div className="two-col">
              <label>
                Primary color
                <span className="color-input-row">
                  <input disabled={!canManageCertificateAdmin} type="color" value={preview.primaryColor} onChange={(event) => setBranding({ ...branding, primaryColor: event.target.value })} />
                  <input
                    disabled={!canManageCertificateAdmin}
                    value={branding.primaryColor ?? ''}
                    onChange={(event) => {
                      setBranding({ ...branding, primaryColor: event.target.value });
                      setBrandingErrors((current) => ({ ...current, primaryColor: '' }));
                    }}
                    className={brandingErrors.primaryColor ? 'input-error' : ''}
                    aria-invalid={!!brandingErrors.primaryColor}
                    placeholder="#122144"
                  />
                </span>
                {brandingErrors.primaryColor ? <span className="field-error">{brandingErrors.primaryColor}</span> : null}
              </label>
              <label>
                Accent color
                <span className="color-input-row">
                  <input disabled={!canManageCertificateAdmin} type="color" value={preview.accentColor} onChange={(event) => setBranding({ ...branding, accentColor: event.target.value })} />
                  <input
                    disabled={!canManageCertificateAdmin}
                    value={branding.accentColor ?? ''}
                    onChange={(event) => {
                      setBranding({ ...branding, accentColor: event.target.value });
                      setBrandingErrors((current) => ({ ...current, accentColor: '' }));
                    }}
                    className={brandingErrors.accentColor ? 'input-error' : ''}
                    aria-invalid={!!brandingErrors.accentColor}
                    placeholder="#F17E22"
                  />
                </span>
                {brandingErrors.accentColor ? <span className="field-error">{brandingErrors.accentColor}</span> : null}
              </label>
            </div>
            <div className="two-col">
              <label>
                Language
                <select disabled={!canManageCertificateAdmin} value={branding.certificateLanguage ?? ''} onChange={(event) => setBranding({ ...branding, certificateLanguage: event.target.value })}>
                  <option value="">Default</option>
                  <option value="en">English</option>
                  <option value="ru">Russian</option>
                  <option value="ky">Kyrgyz</option>
                </select>
              </label>
              <label>
                Page
                <select
                  disabled={!canManageCertificateAdmin}
                  value={branding.pageOrientation ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBranding({
                      ...branding,
                      pageOrientation: value === 'landscape' || value === 'portrait' ? value : null,
                    });
                  }}
                >
                  <option value="">Default</option>
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </label>
            </div>
          </section>
        </form>

        <aside className="settings-panel certificate-preview-panel">
          <h2>Preview</h2>
          <div className={`certificate-preview ${preview.orientation === 'portrait' ? 'portrait' : ''}`} style={{ '--certificate-primary': preview.primaryColor, '--certificate-accent': preview.accentColor } as React.CSSProperties}>
            <div className="certificate-preview-border">
              <header>
                {preview.logoUrl ? <img src={preview.logoUrl} alt="" /> : <div className="certificate-preview-logo">{preview.brandName.slice(0, 1)}</div>}
                <strong>{preview.brandName}</strong>
              </header>
              <main>
                <span>{preview.title}</span>
                <h3>Student Name</h3>
                <p>has successfully completed</p>
                <h4>Course Title</h4>
              </main>
              <footer>
                <div>
                  <span>Issued</span>
                  <strong>{new Date().toLocaleDateString()}</strong>
                </div>
                <div>
                  <span>{preview.issuerTitle}</span>
                  <strong>{preview.issuerName}</strong>
                </div>
              </footer>
            </div>
          </div>
          <div className="definition-grid">
            <span>Language</span><strong>{preview.language}</strong>
            <span>Orientation</span><strong>{preview.orientation}</strong>
          </div>
          <button type="button" className="secondary-button" disabled={!courseId || !courseSettings || previewing} onClick={() => void openBackendPreview()}>
            {previewing ? 'Opening...' : 'Open generated preview'}
          </button>
        </aside>
      </div>
      ) : null}

      {certificateTab !== 'branding' ? (
      <section className="settings-panel full certificate-course-panel">
        <div className="section-heading-row">
          <div>
            <h2>{certificateTab === 'rules' ? 'Course certificate rules' : 'Certificate registry'}</h2>
            <span>{visibleCertificateTabs.find((tab) => tab.key === certificateTab)?.description}</span>
          </div>
        </div>
        <div className="filters-row">
          <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
            <option value="">Select course</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </div>

        {courseLoading ? <LoadingState label="Loading course certificates" /> : null}
        {!courseLoading && !courseSettings ? (
          <EmptyState
            title="Select a course"
            detail="Choose a tenant course to configure eligibility rules and issue certificates."
            action={<Link className="secondary-link-button" to="/courses">Review courses</Link>}
          />
        ) : null}
        {!courseLoading && courseSettings ? (
          <div className="workspace-grid certificate-course-grid single">
            {certificateTab === 'rules' ? (
            <form className="settings-panel embedded-panel" onSubmit={saveCourseSettings}>
              <div className="two-col">
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCertificateAdmin}
                    type="checkbox"
                    checked={courseSettings.enabled ?? true}
                    onChange={(event) => setCourseSettings({ ...courseSettings, enabled: event.target.checked })}
                  />
                  Enable certificates
                </label>
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCertificateAdmin}
                    type="checkbox"
                    checked={courseSettings.allowReissue ?? false}
                    onChange={(event) => setCourseSettings({ ...courseSettings, allowReissue: event.target.checked })}
                  />
                  Allow reissue
                </label>
              </div>
              <div className="two-col">
                <label>
                  Issue mode
                  <select disabled={!canManageCertificateAdmin} value={courseSettings.issueMode ?? 'auto'} onChange={(event) => setCourseSettings({ ...courseSettings, issueMode: event.target.value as 'manual' | 'auto' })}>
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label>
                  Approval
                  <select disabled={!canManageCertificateAdmin} value={courseSettings.approvalMode ?? 'none'} onChange={(event) => setCourseSettings({ ...courseSettings, approvalMode: event.target.value as 'none' | 'instructor' | 'admin' })}>
                    <option value="none">None</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <label>
                Certificate title
                <input disabled={!canManageCertificateAdmin} value={courseSettings.certificateTitle ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, certificateTitle: event.target.value })} />
              </label>
              <label>
                Signature image
                <input type="file" accept="image/*" onChange={(event) => void uploadSignature(event.target.files?.[0])} />
                {courseSettingsErrors.signature ? <span className="field-error">{courseSettingsErrors.signature}</span> : null}
              </label>
              <div className="two-col">
                <label>
                  Attendance %
                  <input
                    disabled={!canManageCertificateAdmin}
                    type="number"
                    min="0"
                    max="100"
                    value={courseSettings.eligibilityAttendancePercent ?? 80}
                    onChange={(event) => {
                      setCourseSettings({ ...courseSettings, eligibilityAttendancePercent: Number(event.target.value) });
                      setCourseSettingsErrors((current) => ({ ...current, attendance: '' }));
                    }}
                    className={courseSettingsErrors.attendance ? 'input-error' : ''}
                    aria-invalid={!!courseSettingsErrors.attendance}
                  />
                  {courseSettingsErrors.attendance ? <span className="field-error">{courseSettingsErrors.attendance}</span> : null}
                </label>
                <label>
                  Homework %
                  <input
                    disabled={!canManageCertificateAdmin}
                    type="number"
                    min="0"
                    max="100"
                    value={courseSettings.eligibilityHomeworkPercent ?? 100}
                    onChange={(event) => {
                      setCourseSettings({ ...courseSettings, eligibilityHomeworkPercent: Number(event.target.value) });
                      setCourseSettingsErrors((current) => ({ ...current, homework: '' }));
                    }}
                    className={courseSettingsErrors.homework ? 'input-error' : ''}
                    aria-invalid={!!courseSettingsErrors.homework}
                  />
                  {courseSettingsErrors.homework ? <span className="field-error">{courseSettingsErrors.homework}</span> : null}
                </label>
              </div>
              {canManageCertificateAdmin ? <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save course settings'}</button> : null}
            </form>
            ) : null}

            {certificateTab === 'registry' ? (
            <div className="settings-panel embedded-panel">
              <h2>Certificates</h2>
              <div className="page-actions">
                {canManageCertificateRegistry ? (
                  <>
                    <button type="button" disabled={!courseId || issuing} onClick={() => setIsIssueModalOpen(true)}>
                      Issue certificate
                    </button>
                    <button type="button" className="secondary-button" disabled={regenerating || !certificates.some((certificate) => certificate.status === 'issued')} onClick={() => void regenerateIssuedCertificates()}>
                      {regenerating ? 'Regenerating...' : 'Regenerate issued PDFs'}
                    </button>
                  </>
                ) : null}
              </div>
              <CountFilterRow
                className="certificate-summary-row"
                ariaLabel="Certificate status filters"
                items={(['total', 'issued', 'pending_approval', 'rejected', 'revoked'] as const).map((key) => ({
                  key,
                  label: key.replace('_', ' '),
                  count: certificateCounts[key] ?? 0,
                  active: certificateStatus === key || (key === 'total' && certificateStatus === 'all'),
                }))}
                onSelect={(key) => setCertificateStatus(key === 'total' ? 'all' : key)}
              />
              <div className="filters-row certificate-filters">
                <input
                  value={certificateQuery}
                  onChange={(event) => setCertificateQuery(event.target.value)}
                  placeholder="Search student, public ID, or status"
                />
                <select value={certificateStatus} onChange={(event) => setCertificateStatus(event.target.value)}>
                  {certificateStatuses.map((status) => (
                    <option key={status} value={status}>{status === 'all' ? 'All statuses' : status.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="stack-list">
                {filteredCertificates.slice(0, 12).map((certificate) => (
                  <article key={certificate.id} className="stack-list-item">
                    <div>
                      <strong>{certificate.studentName || `Student ${certificate.studentId}`}</strong>
                      <span><span className={`status-badge ${certificate.status}`}>{certificate.status.replace('_', ' ')}</span> · {formatDate(certificate.issuedAt ?? certificate.requestedAt)}</span>
                    </div>
                    <div className="certificate-actions">
                      {canManageCertificateRegistry && certificate.status === 'pending_approval' ? (
                        <>
                          <button type="button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'approve')}>Approve</button>
                          <button type="button" className="secondary-button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'reject')}>Reject</button>
                        </>
                      ) : null}
                      {certificate.status === 'issued' ? (
                        <>
                          {certificate.downloadUrl ? <a href={certificate.downloadUrl} target="_blank" rel="noreferrer">Download</a> : null}
                          {canManageCertificateRegistry ? (
                            <>
                              <button type="button" className="secondary-button" disabled={regenerating} onClick={() => void regenerateIssuedCertificates(certificate.id)}>Regenerate</button>
                              <button type="button" className="secondary-button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'revoke')}>Revoke</button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      {certificate.status !== 'pending_approval' && certificate.status !== 'issued' ? <strong>{certificate.source ?? '-'}</strong> : null}
                    </div>
                  </article>
                ))}
                {!certificates.length ? <span className="muted-text">No certificates for this course yet.</span> : null}
                {certificates.length > 0 && !filteredCertificates.length ? <span className="muted-text">No certificates match the current filters.</span> : null}
              </div>
            </div>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}
      {isIssueModalOpen && canManageCertificateRegistry ? (
        <FormModal labelledBy="issue-certificate-title" onClose={() => { setIsIssueModalOpen(false); setIssueErrors({}); }} onSubmit={issueCertificate}>
            <div>
              <span className="status-badge published">{courses.find((course) => course.id === courseId)?.title ?? 'Course required'}</span>
              <h2 id="issue-certificate-title">Issue certificate</h2>
              <p>Manually issue a certificate for an eligible learner in this course.</p>
            </div>
            <div className="student-search-row">
              <label>
                Search student
                <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Name or email" autoFocus />
              </label>
              <button type="button" className="secondary-button" disabled={issuing} onClick={() => void runStudentSearch()}>
                Search
              </button>
            </div>
            <label>
              Student
              <select
                value={selectedStudentId ?? ''}
                onChange={(event) => {
                  setSelectedStudentId(Number(event.target.value) || undefined);
                  setIssueErrors((current) => ({ ...current, student: '' }));
                }}
                disabled={!studentResults.length}
                className={issueErrors.student ? 'input-error' : ''}
                aria-invalid={!!issueErrors.student}
              >
                <option value="">Select student</option>
                {studentResults.map((student) => (
                  <option key={student.id} value={student.id}>{student.fullName || student.email} ({student.email})</option>
                ))}
              </select>
              {issueErrors.student ? <span className="field-error">{issueErrors.student}</span> : null}
            </label>
            <label>
              Note
              <input value={certificateNote} onChange={(event) => setCertificateNote(event.target.value)} placeholder="Optional internal note" />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setIsIssueModalOpen(false)} disabled={issuing}>Cancel</button>
              <button type="submit" disabled={!courseId || !selectedStudentId || issuing}>{issuing ? 'Issuing...' : 'Issue certificate'}</button>
            </div>
        </FormModal>
      ) : null}
      {pendingDecision && canManageCertificateRegistry ? (
        <Modal
          labelledBy="certificate-decision-title"
          onClose={() => {
            setPendingDecision(null);
            setDecisionReason('');
          }}
        >
            <div>
              <span className={`status-badge ${pendingDecision.action}`}>{pendingDecision.action}</span>
              <h2 id="certificate-decision-title">{pendingDecision.action === 'approve' ? 'Approve certificate' : `${pendingDecision.action[0].toUpperCase()}${pendingDecision.action.slice(1)} certificate`}</h2>
              <p>
                {pendingDecision.certificate.studentName || `Student ${pendingDecision.certificate.studentId}`} · {pendingDecision.certificate.publicId}
              </p>
            </div>
            {pendingDecision.action === 'approve' ? (
              <p className="panel-note">This will make the certificate available according to the current course certificate settings.</p>
            ) : (
              <label>
                Reason
                <textarea
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  placeholder={`Reason to ${pendingDecision.action} this certificate`}
                  autoFocus
                />
              </label>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPendingDecision(null);
                  setDecisionReason('');
                }}
                disabled={decisionId === pendingDecision.certificate.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className={pendingDecision.action === 'approve' ? undefined : 'danger-button'}
                onClick={() => void handleCertificateDecision()}
                disabled={decisionId === pendingDecision.certificate.id}
              >
                {decisionId === pendingDecision.certificate.id ? 'Working...' : pendingDecision.action === 'approve' ? 'Approve' : `${pendingDecision.action[0].toUpperCase()}${pendingDecision.action.slice(1)}`}
              </button>
            </div>
        </Modal>
      ) : null}
    </>
  );
}
