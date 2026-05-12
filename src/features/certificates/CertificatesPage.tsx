import { FormEvent, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';
import { CountFilterRow } from '../../components/CountFilterRow';
import {
  approveCertificate,
  downloadCertificatePdf,
  getCertificateBranding,
  getCourseCertificateSettings,
  issueCourseCertificate,
  listCourseCertificates,
  listCourseStudents,
  listTenantCourses,
  previewCourseCertificate,
  regenerateCourseCertificates,
  rejectCertificate,
  revokeCertificate,
  updateCertificateBranding,
  updateCourseCertificateSettings,
  uploadCertificateLogo,
  uploadCourseCertificateSecondaryLogo,
  uploadCourseCertificateSignature,
} from '../../services/api';
import type { CertificateBranding, Course, CourseCertificate, CourseCertificateSettings, GroupStudent } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate } from '../../lib/format';
import { useAuth } from '../auth/AuthProvider';
import { isTenantAdmin } from '../tenant/tenantRoles';

type CertificateDecision = {
  certificate: CourseCertificate;
  action: 'approve' | 'reject' | 'revoke';
};

type CertificateTab = 'branding' | 'rules' | 'registry';
type CertificateLanguageValue = 'en' | 'ru' | 'ky';
type CertificateOrientationValue = 'landscape' | 'portrait';

const certificateTabs: Array<{ key: CertificateTab; label: string; description: string }> = [
  { key: 'branding', label: 'Branding', description: 'Certificate template, logo, colors, and preview.' },
  { key: 'rules', label: 'Course rules', description: 'Eligibility, issue mode, approval, and signatures.' },
  { key: 'registry', label: 'Registry', description: 'Issue, approve, regenerate, and search certificates.' },
];

const eligibilityReasonLabels: Record<string, string> = {
  sessions_missing: 'No delivery sessions exist yet',
  sessions_incomplete: 'Sessions are not completed',
  attendance_below_threshold: 'Attendance is below requirement',
  homework_below_threshold: 'Homework is below requirement',
  activities_below_threshold: 'Activities are below requirement',
  lesson_progress_incomplete: 'Lesson progress is incomplete',
};

function describeEligibility(student?: GroupStudent | null) {
  const eligibility = student?.certificateEligibility;
  if (!eligibility) return student?.certificateEligible ? 'Eligible' : 'Eligibility unavailable';
  if (eligibility.eligible) return 'Eligible';
  const reasons = eligibility.reasons ?? [];
  return reasons.map((reason) => eligibilityReasonLabels[reason] ?? reason.replaceAll('_', ' ')).join(', ') || 'Requirements not met';
}

function getPreviewRootNode(doc?: Document | null) {
  if (!doc?.body) return null;
  return Array.from(doc.body.children).find((child) => !['STYLE', 'SCRIPT', 'META', 'LINK'].includes(child.tagName)) as HTMLElement | undefined;
}

function normalizeExactPreviewHtml(html: string) {
  const fitStyles = `
    <style id="edubot-preview-fit">
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        background: #ffffff !important;
        overflow: hidden !important;
      }
      body > * {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: none !important;
        flex: 0 0 auto !important;
      }
    </style>
  `;
  const withViewport = html.includes('name="viewport"')
    ? html
    : html.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width, initial-scale=1" />');
  return /<head[^>]*>/i.test(withViewport)
    ? withViewport.replace(/<\/head>/i, `${fitStyles}</head>`)
    : `${fitStyles}${withViewport}`;
}

function fitExactPreviewFrame(iframe: HTMLIFrameElement | null) {
  const fit = () => {
    const doc = iframe?.contentDocument;
    const root = getPreviewRootNode(doc);
    if (!iframe || !doc || !root) return;

    const availableWidth = Math.max(iframe.clientWidth - 24, 220);
    const availableHeight = Math.max(iframe.clientHeight - 24, 180);

    doc.documentElement.style.margin = '0';
    doc.documentElement.style.padding = '0';
    doc.documentElement.style.width = '100%';
    doc.documentElement.style.overflow = 'hidden';
    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.width = '100%';
    doc.body.style.overflow = 'hidden';
    doc.body.style.background = '#ffffff';

    root.style.transform = 'none';
    root.style.transformOrigin = 'top left';
    root.style.position = 'absolute';
    root.style.left = '0';
    root.style.top = '0';
    root.style.margin = '0';
    root.style.maxWidth = 'none';

    const rect = root.getBoundingClientRect();
    const baseWidth = Math.max(root.scrollWidth, root.offsetWidth, rect.width);
    const baseHeight = Math.max(root.scrollHeight, root.offsetHeight, rect.height);
    if (!baseWidth || !baseHeight) return;

    const scale = Math.min(availableWidth / baseWidth, availableHeight / baseHeight, 1);
    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;
    root.style.left = `${Math.max((iframe.clientWidth - scaledWidth) / 2, 0)}px`;
    root.style.top = `${Math.max((iframe.clientHeight - scaledHeight) / 2, 0)}px`;
    root.style.transform = `scale(${scale})`;
    doc.documentElement.style.height = `${iframe.clientHeight}px`;
    doc.body.style.height = `${iframe.clientHeight}px`;
  };

  const scheduleFit = () => window.requestAnimationFrame(fit);
  const timeouts = [0, 80, 240].map((delay) => window.setTimeout(scheduleFit, delay));
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleFit);
  if (iframe) resizeObserver?.observe(iframe);
  if (iframe?.parentElement) resizeObserver?.observe(iframe.parentElement);
  window.addEventListener('resize', scheduleFit);
  iframe?.contentWindow?.addEventListener('resize', scheduleFit);

  return () => {
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    resizeObserver?.disconnect();
    window.removeEventListener('resize', scheduleFit);
    iframe?.contentWindow?.removeEventListener('resize', scheduleFit);
  };
}

export function CertificatesPage() {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const canManageCertificateAdmin = isTenantAdmin(user, activeTenant);
  const canManageCourseRules = canManageCertificateAdmin;
  const requestedCourseId = Number(searchParams.get('courseId')) || undefined;
  const requestedTab = searchParams.get('tab') as CertificateTab | null;
  const [branding, setBranding] = useState<CertificateBranding | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [courseSettings, setCourseSettings] = useState<CourseCertificateSettings | null>(null);
  const [certificates, setCertificates] = useState<CourseCertificate[]>([]);
  const [certificateQuery, setCertificateQuery] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [courseStudents, setCourseStudents] = useState<GroupStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>();
  const [previewStudentName, setPreviewStudentName] = useState('');
  const [previewIssuerName, setPreviewIssuerName] = useState('');
  const [previewIssuerTitle, setPreviewIssuerTitle] = useState('');
  const [previewLanguage, setPreviewLanguage] = useState<CertificateLanguageValue>('en');
  const [previewOrientation, setPreviewOrientation] = useState<CertificateOrientationValue>('landscape');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentProgressFilter, setStudentProgressFilter] = useState<'all' | 'eligible' | 'blocked'>('all');
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
  const [exactPreviewHtml, setExactPreviewHtml] = useState('');
  const [exactPreviewError, setExactPreviewError] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<CertificateDecision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const previewFrameCleanupRef = useRef<Record<string, (() => void) | undefined>>({});
  const [certificateTab, setCertificateTab] = useState<CertificateTab>(
    canManageCertificateAdmin && requestedTab && certificateTabs.some((tab) => tab.key === requestedTab)
      ? requestedTab
      : canManageCertificateAdmin
        ? 'branding'
        : 'registry',
  );
  const visibleCertificateTabs = useMemo(
    () => canManageCertificateAdmin ? certificateTabs : certificateTabs.filter((tab) => tab.key === 'registry'),
    [canManageCertificateAdmin],
  );
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    if (!canManageCertificateAdmin && certificateTab !== 'registry') {
      setCertificateTab('registry');
    }
  }, [canManageCertificateAdmin, certificateTab]);

  useEffect(() => {
    const next = new URLSearchParams(searchParamsString);
    if (courseId) next.set('courseId', String(courseId)); else next.delete('courseId');
    next.set('tab', certificateTab);
    if (next.toString() !== searchParamsString) {
      setSearchParams(next, { replace: true });
    }
  }, [certificateTab, courseId, searchParamsString, setSearchParams]);

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
    setCourseId((current) => {
      if (!courses.length) return undefined;
      if (requestedCourseId && courses.some((course) => course.id === requestedCourseId)) return requestedCourseId;
      return current && courses.some((course) => course.id === current) ? current : courses[0]?.id;
    });
  }, [courses, requestedCourseId]);

  useEffect(() => {
    setCourseSettings(null);
    setCertificates([]);
    setCourseStudents([]);
    setCertificateQuery('');
    setCertificateStatus('all');
    setSelectedStudentId(undefined);
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

  useEffect(() => {
    if (!courseId || certificateTab !== 'registry') return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setStudentLoading(true);
      listCourseStudents(courseId, {
        limit: 100,
        q: studentSearch.trim() || undefined,
        progressGte: studentProgressFilter === 'eligible' ? 100 : undefined,
        progressLte: studentProgressFilter === 'blocked' ? 99 : undefined,
      })
        .then((result) => {
          if (!cancelled) setCourseStudents(result.students);
        })
        .catch(() => {
          if (!cancelled) toast.error('Could not load certificate roster');
        })
        .finally(() => {
          if (!cancelled) setStudentLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [certificateTab, courseId, studentProgressFilter, studentSearch]);

  const preview = useMemo(() => ({
    brandName: branding?.primaryBrandName || activeTenant?.name || 'Tenant name',
    logoUrl: branding?.primaryBrandLogoUrl || activeTenant?.logoUrl || null,
    title: branding?.certificateTitle || 'Certificate of Completion',
    issuerName: previewIssuerName || branding?.issuerDisplayName || activeTenant?.name || 'Issuer name',
    issuerTitle: previewIssuerTitle || branding?.issuerTitle || 'Instructor',
    primaryColor: branding?.primaryColor || '#122144',
    accentColor: branding?.accentColor || '#f17e22',
    language: previewLanguage,
    orientation: previewOrientation,
  }), [activeTenant?.logoUrl, activeTenant?.name, branding, previewIssuerName, previewIssuerTitle, previewLanguage, previewOrientation]);

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

  const selectedStudent = useMemo(
    () => courseStudents.find((student) => student.id === selectedStudentId || student.userId === selectedStudentId),
    [courseStudents, selectedStudentId],
  );
  const selectedCertificateCourse = useMemo(
    () => courses.find((course) => course.id === courseId),
    [courseId, courses],
  );
  const selectedCourseIsDelivery = selectedCertificateCourse?.courseType === 'offline' || selectedCertificateCourse?.courseType === 'online_live';
  const canIssueCertificates = true;
  const canRevokeCertificates = canManageCertificateAdmin;
  const canRegenerateCertificates = canManageCertificateAdmin;
  const canApproveCertificates = canManageCertificateAdmin || courseSettings?.approvalMode === 'instructor';
  const rosterCounts = useMemo(() => {
    const eligible = courseStudents.filter((student) => student.certificateEligibility?.eligible || student.certificateEligible).length;
    return {
      total: courseStudents.length,
      eligible,
      blocked: Math.max(0, courseStudents.length - eligible),
      issued: courseStudents.filter((student) => student.certificateStatus === 'issued' || student.hasCertificate).length,
      pending: courseStudents.filter((student) => student.certificateStatus === 'pending_approval').length,
    };
  }, [courseStudents]);

  useEffect(() => {
    if (!branding && !activeTenant) return;
    setPreviewIssuerName(user?.fullName || branding?.issuerDisplayName || activeTenant?.name || '');
    setPreviewIssuerTitle(branding?.issuerTitle || (canManageCertificateAdmin ? 'Admin' : 'Instructor'));
    setPreviewLanguage(
      branding?.certificateLanguage === 'ru' || branding?.certificateLanguage === 'ky' ? branding.certificateLanguage : 'en',
    );
    setPreviewOrientation(branding?.pageOrientation === 'portrait' ? 'portrait' : 'landscape');
  }, [activeTenant, branding, canManageCertificateAdmin, courseId, user?.fullName]);

  useEffect(() => {
    const nextStudentName = selectedStudent?.fullName || selectedStudent?.email || courseStudents[0]?.fullName || courseStudents[0]?.email || '';
    setPreviewStudentName(nextStudentName);
  }, [courseId, courseStudents, selectedStudent]);

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
    const hexColorPattern = /^#?[0-9a-fA-F]{6}$/;
    const attendancePercent = courseSettings.eligibilityAttendancePercent ?? 80;
    const homeworkPercent = courseSettings.eligibilityHomeworkPercent ?? 100;
    const activitiesPercent = courseSettings.eligibilityActivitiesPercent ?? 100;
    if (courseSettings.primaryColor && !hexColorPattern.test(courseSettings.primaryColor)) {
      nextErrors.primaryColor = 'Use a 6-digit hex color, for example #122144.';
    }
    if (courseSettings.accentColor && !hexColorPattern.test(courseSettings.accentColor)) {
      nextErrors.accentColor = 'Use a 6-digit hex color, for example #f17e22.';
    }
    if (attendancePercent < 0 || attendancePercent > 100) {
      nextErrors.attendance = 'Attendance must be between 0 and 100.';
    }
    if (homeworkPercent < 0 || homeworkPercent > 100) {
      nextErrors.homework = 'Homework must be between 0 and 100.';
    }
    if (activitiesPercent < 0 || activitiesPercent > 100) {
      nextErrors.activities = 'Activities must be between 0 and 100.';
    }
    if (Object.keys(nextErrors).length) {
      setCourseSettingsErrors(nextErrors);
      toast.error(nextErrors.primaryColor ?? nextErrors.accentColor ?? nextErrors.attendance ?? nextErrors.homework ?? nextErrors.activities);
      return;
    }

    setCourseSettingsErrors({});
    setSaving(true);
    try {
      const saved = await updateCourseCertificateSettings(courseId, {
        ...courseSettings,
        issueMode: selectedCourseIsDelivery ? 'manual' : courseSettings.issueMode,
      });
      setCourseSettings(saved);
      toast.success('Course certificate settings saved');
    } catch {
      toast.error('Could not save course certificate settings');
    } finally {
      setSaving(false);
    }
  };

  const loadExactPreview = useCallback(async () => {
    if (!courseId || !courseSettings || !branding) return;
    setPreviewing(true);
    setExactPreviewError('');
    try {
      const html = await previewCourseCertificate(courseId, {
        ...courseSettings,
        certificateLanguage: previewLanguage,
        pageOrientation: previewOrientation,
        previewStudentName: previewStudentName.trim() || courseStudents[0]?.fullName || 'Student Name',
        previewCourseTitle: selectedCertificateCourse?.title ?? 'Course Title',
        previewIssuerName: previewIssuerName.trim() || branding.issuerDisplayName || activeTenant?.name || 'Issuer name',
        previewIssuerTitle: previewIssuerTitle.trim() || branding.issuerTitle || 'Instructor',
        previewIssuedAt: new Date().toISOString(),
      });
      setExactPreviewHtml(normalizeExactPreviewHtml(html));
    } catch {
      setExactPreviewError('Could not load generated preview');
      toast.error('Could not load certificate preview');
    } finally {
      setPreviewing(false);
    }
  }, [activeTenant?.name, branding, courseId, courseSettings, courseStudents, previewIssuerName, previewIssuerTitle, previewLanguage, previewOrientation, previewStudentName, selectedCertificateCourse?.title]);

  useEffect(() => () => {
    Object.values(previewFrameCleanupRef.current).forEach((cleanup) => cleanup?.());
    previewFrameCleanupRef.current = {};
  }, []);

  const handlePreviewFrameLoad = (surface: 'inline' | 'modal') => (event: SyntheticEvent<HTMLIFrameElement>) => {
    previewFrameCleanupRef.current[surface]?.();
    previewFrameCleanupRef.current[surface] = fitExactPreviewFrame(event.currentTarget);
  };

  useEffect(() => {
    if (!courseId || !courseSettings || !branding) {
      setExactPreviewHtml('');
      setExactPreviewError('');
      return;
    }
    const timeout = window.setTimeout(() => {
      void loadExactPreview();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [branding, courseId, courseSettings, loadExactPreview]);

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

  const uploadSecondaryLogo = async (file?: File) => {
    if (!courseId || !file) {
      setCourseSettingsErrors((current) => ({ ...current, secondaryLogo: 'Choose a secondary brand logo to upload.' }));
      toast.error('Choose a secondary brand logo to upload');
      return;
    }
    setCourseSettingsErrors((current) => ({ ...current, secondaryLogo: '' }));
    setSaving(true);
    try {
      const saved = await uploadCourseCertificateSecondaryLogo(courseId, file);
      setCourseSettings(saved);
      toast.success('Secondary logo uploaded');
    } catch {
      setCourseSettingsErrors((current) => ({ ...current, secondaryLogo: 'Could not upload secondary logo.' }));
      toast.error('Could not upload secondary logo');
    } finally {
      setSaving(false);
    }
  };

  const reloadCourseCertificates = async (nextCourseId = courseId) => {
    if (!nextCourseId) return;
    const rows = await listCourseCertificates(nextCourseId);
    setCertificates(rows);
  };

  const reloadCertificateRoster = async (nextCourseId = courseId) => {
    if (!nextCourseId) return;
    const result = await listCourseStudents(nextCourseId, {
      limit: 100,
      q: studentSearch.trim() || undefined,
      progressGte: studentProgressFilter === 'eligible' ? 100 : undefined,
      progressLte: studentProgressFilter === 'blocked' ? 99 : undefined,
    });
    setCourseStudents(result.students);
  };

  const downloadIssuedCertificate = async (downloadUrl?: string | null, publicId?: string | null) => {
    if (!downloadUrl) return;
    try {
      await downloadCertificatePdf(downloadUrl, `certificate-${publicId ?? 'issued'}.pdf`);
    } catch {
      toast.error('Could not download certificate');
    }
  };

  const openIssueForStudent = (student: GroupStudent) => {
    setIssueErrors({});
    setSelectedStudentId(student.id);
    setPreviewStudentName(student.fullName || student.email || '');
    setCertificateNote('');
    setIsIssueModalOpen(true);
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
    const student = courseStudents.find((item) => item.id === selectedStudent || item.userId === selectedStudent);
    const allowEligibilityOverride = student?.certificateEligibility && !student.certificateEligibility.eligible
      ? window.confirm(`This student is not eligible yet: ${describeEligibility(student)}. Issue anyway?`)
      : false;
    if (student?.certificateEligibility && !student.certificateEligibility.eligible && !allowEligibilityOverride) {
      setIssuing(false);
      return;
    }
    setIssuing(true);
    try {
      await issueCourseCertificate(activeCourseId, {
        studentId: selectedStudent,
        studentFullName: previewStudentName.trim() || student?.fullName,
        issuerDisplayName: previewIssuerName.trim() || undefined,
        issuerTitle: previewIssuerTitle.trim() || undefined,
        certificateLanguage: previewLanguage,
        pageOrientation: previewOrientation,
        note: certificateNote.trim() || undefined,
        allowEligibilityOverride,
      });
      await reloadCourseCertificates(courseId);
      await reloadCertificateRoster(courseId);
      setCertificateNote('');
      setStudentSearch('');
      setSelectedStudentId(undefined);
      setPreviewStudentName('');
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
    studentFullName?: string;
    issuerDisplayName?: string;
    issuerTitle?: string;
    certificateLanguage?: 'en' | 'ru' | 'ky';
    pageOrientation?: 'landscape' | 'portrait';
  } => {
    return {
      studentFullName: previewStudentName.trim() || undefined,
      issuerDisplayName: previewIssuerName.trim() || undefined,
      issuerTitle: previewIssuerTitle.trim() || undefined,
      certificateLanguage: previewLanguage,
      pageOrientation: previewOrientation,
    };
  };

  const openCertificateDecision = (certificate: CourseCertificate, action: 'approve' | 'reject' | 'revoke') => {
    setPreviewStudentName(certificate.studentName || '');
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
      await reloadCertificateRoster(courseId);
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
      await reloadCertificateRoster(courseId);
      toast.success(`Regenerated ${result.regeneratedCount} certificate${result.regeneratedCount === 1 ? '' : 's'}`);
    } catch {
      toast.error('Could not regenerate certificates');
    } finally {
      setRegenerating(false);
    }
  };

  const renderCertificateDisplayControls = (className = '') => (
    <div className={`certificate-display-controls ${className}`}>
      <label>
        Student name
        <input
          value={previewStudentName}
          onChange={(event) => setPreviewStudentName(event.target.value)}
          placeholder={selectedStudent?.fullName || 'Student name'}
        />
      </label>
      <label>
        Issuer name
        <input
          value={previewIssuerName}
          onChange={(event) => setPreviewIssuerName(event.target.value)}
          placeholder={user?.fullName || activeTenant?.name || 'Issuer name'}
        />
      </label>
      <label>
        Issuer title
        <input
          value={previewIssuerTitle}
          onChange={(event) => setPreviewIssuerTitle(event.target.value)}
          placeholder="Instructor"
        />
      </label>
      <label>
        Language
        <select value={previewLanguage} onChange={(event) => setPreviewLanguage(event.target.value as CertificateLanguageValue)}>
          <option value="en">English</option>
          <option value="ru">Russian</option>
          <option value="ky">Kyrgyz</option>
        </select>
      </label>
      <label>
        Certificate mode
        <select value={previewOrientation} onChange={(event) => setPreviewOrientation(event.target.value as CertificateOrientationValue)}>
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
        </select>
      </label>
    </div>
  );

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
          <div className="section-heading-row compact">
            <div>
              <h2>Preview</h2>
              <span>Generated certificate output for the selected course.</span>
            </div>
          </div>
          <div className="certificate-preview-actions">
            <button type="button" className="secondary-button" disabled={!courseId || !courseSettings || previewing} onClick={() => void loadExactPreview()}>
              {previewing ? 'Refreshing...' : 'Refresh preview'}
            </button>
            <button type="button" className="secondary-button" disabled={!exactPreviewHtml} onClick={() => setIsPreviewModalOpen(true)}>
              Full preview
            </button>
          </div>
          {previewing ? (
            <div className="certificate-preview-loading">Generated preview loading...</div>
          ) : exactPreviewHtml && !exactPreviewError ? (
            <iframe title="Generated certificate preview" srcDoc={exactPreviewHtml} scrolling="no" onLoad={handlePreviewFrameLoad('inline')} className={`certificate-preview-frame ${preview.orientation === 'portrait' ? 'portrait' : ''}`} />
          ) : (
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
          )}
          {exactPreviewError ? <span className="field-error">{exactPreviewError}</span> : null}
          <div className="definition-grid">
            <span>Language</span><strong>{preview.language}</strong>
            <span>Orientation</span><strong>{preview.orientation}</strong>
          </div>
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
                  <select disabled={!canManageCourseRules || selectedCourseIsDelivery} value={selectedCourseIsDelivery ? 'manual' : courseSettings.issueMode ?? 'auto'} onChange={(event) => setCourseSettings({ ...courseSettings, issueMode: event.target.value as 'manual' | 'auto' })}>
                    {!selectedCourseIsDelivery ? <option value="auto">Auto</option> : null}
                    <option value="manual">Manual</option>
                  </select>
                  {selectedCourseIsDelivery ? <span className="muted-text">Offline and live courses require manual certificate issue.</span> : null}
                </label>
                <label>
                  Approval
                  <select disabled={!canManageCourseRules} value={courseSettings.approvalMode ?? 'none'} onChange={(event) => setCourseSettings({ ...courseSettings, approvalMode: event.target.value as 'none' | 'instructor' | 'admin' })}>
                    <option value="none">None</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <label>
                Certificate title
                <input disabled={!canManageCourseRules} value={courseSettings.certificateTitle ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, certificateTitle: event.target.value })} placeholder={branding.certificateTitle || 'Certificate of Achievement'} />
              </label>
              <label>
                Secondary brand
                <input disabled={!canManageCourseRules} value={courseSettings.secondaryBrandName ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, secondaryBrandName: event.target.value })} placeholder="Partner or sponsor name" />
              </label>
              <label>
                Signature image
                <input disabled={!canManageCourseRules} type="file" accept="image/*" onChange={(event) => void uploadSignature(event.target.files?.[0])} />
                {courseSettingsErrors.signature ? <span className="field-error">{courseSettingsErrors.signature}</span> : null}
                {courseSettings.signatureAssetUrl ? <span className="muted-text">Signature uploaded.</span> : null}
              </label>
              <label>
                Secondary brand logo
                <input disabled={!canManageCourseRules} type="file" accept="image/*" onChange={(event) => void uploadSecondaryLogo(event.target.files?.[0])} />
                {courseSettingsErrors.secondaryLogo ? <span className="field-error">{courseSettingsErrors.secondaryLogo}</span> : null}
                {courseSettings.secondaryBrandLogoUrl ? <span className="muted-text">Secondary logo uploaded.</span> : null}
              </label>
              <div className="two-col">
                <label>
                  Certificate language
                  <select disabled={!canManageCourseRules} value={courseSettings.certificateLanguage ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, certificateLanguage: (event.target.value || null) as CourseCertificateSettings['certificateLanguage'] })}>
                    <option value="">Tenant default</option>
                    <option value="en">English</option>
                    <option value="ru">Russian</option>
                    <option value="ky">Kyrgyz</option>
                  </select>
                </label>
                <label>
                  Certificate mode
                  <select disabled={!canManageCourseRules} value={courseSettings.pageOrientation ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, pageOrientation: (event.target.value || null) as CourseCertificateSettings['pageOrientation'] })}>
                    <option value="">Tenant default</option>
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </label>
              </div>
              <div className="two-col">
                <label>
                  Primary color
                  <span className="color-input-row">
                    <input disabled={!canManageCourseRules} type="color" value={courseSettings.primaryColor || branding.primaryColor || '#122144'} onChange={(event) => setCourseSettings({ ...courseSettings, primaryColor: event.target.value })} />
                    <input
                      disabled={!canManageCourseRules}
                      value={courseSettings.primaryColor ?? ''}
                      onChange={(event) => {
                        setCourseSettings({ ...courseSettings, primaryColor: event.target.value });
                        setCourseSettingsErrors((current) => ({ ...current, primaryColor: '' }));
                      }}
                      className={courseSettingsErrors.primaryColor ? 'input-error' : ''}
                      aria-invalid={!!courseSettingsErrors.primaryColor}
                      placeholder={branding.primaryColor || '#122144'}
                    />
                  </span>
                  {courseSettingsErrors.primaryColor ? <span className="field-error">{courseSettingsErrors.primaryColor}</span> : null}
                </label>
                <label>
                  Accent color
                  <span className="color-input-row">
                    <input disabled={!canManageCourseRules} type="color" value={courseSettings.accentColor || branding.accentColor || '#f17e22'} onChange={(event) => setCourseSettings({ ...courseSettings, accentColor: event.target.value })} />
                    <input
                      disabled={!canManageCourseRules}
                      value={courseSettings.accentColor ?? ''}
                      onChange={(event) => {
                        setCourseSettings({ ...courseSettings, accentColor: event.target.value });
                        setCourseSettingsErrors((current) => ({ ...current, accentColor: '' }));
                      }}
                      className={courseSettingsErrors.accentColor ? 'input-error' : ''}
                      aria-invalid={!!courseSettingsErrors.accentColor}
                      placeholder={branding.accentColor || '#f17e22'}
                    />
                  </span>
                  {courseSettingsErrors.accentColor ? <span className="field-error">{courseSettingsErrors.accentColor}</span> : null}
                </label>
              </div>
              <div className="two-col">
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCourseRules}
                    type="checkbox"
                    checked={courseSettings.eligibilityAttendanceRequired ?? selectedCourseIsDelivery}
                    onChange={(event) => setCourseSettings({ ...courseSettings, eligibilityAttendanceRequired: event.target.checked })}
                  />
                  Require attendance
                </label>
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCourseRules}
                    type="checkbox"
                    checked={courseSettings.eligibilityHomeworkRequired ?? false}
                    onChange={(event) => setCourseSettings({ ...courseSettings, eligibilityHomeworkRequired: event.target.checked })}
                  />
                  Require homework
                </label>
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCourseRules}
                    type="checkbox"
                    checked={courseSettings.eligibilityActivitiesRequired ?? false}
                    onChange={(event) => setCourseSettings({ ...courseSettings, eligibilityActivitiesRequired: event.target.checked })}
                  />
                  Require activities
                </label>
              </div>
              <div className="three-col">
                <label>
                  Attendance %
                  <input
                    disabled={!canManageCourseRules}
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
                    disabled={!canManageCourseRules}
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
                <label>
                  Activities %
                  <input
                    disabled={!canManageCourseRules}
                    type="number"
                    min="0"
                    max="100"
                    value={courseSettings.eligibilityActivitiesPercent ?? 100}
                    onChange={(event) => {
                      setCourseSettings({ ...courseSettings, eligibilityActivitiesPercent: Number(event.target.value) });
                      setCourseSettingsErrors((current) => ({ ...current, activities: '' }));
                    }}
                    className={courseSettingsErrors.activities ? 'input-error' : ''}
                    aria-invalid={!!courseSettingsErrors.activities}
                  />
                  {courseSettingsErrors.activities ? <span className="field-error">{courseSettingsErrors.activities}</span> : null}
                </label>
              </div>
              {canManageCourseRules ? <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save course settings'}</button> : null}
            </form>
            ) : null}

            {certificateTab === 'registry' ? (
            <div className="settings-panel embedded-panel">
              <div className="section-heading-row compact">
                <div>
                  <h2>Course certificate workspace</h2>
                  <span>{selectedCertificateCourse?.title ?? 'Select a course'}</span>
                </div>
              </div>
              <div className="definition-grid">
                <span>Course type</span><strong>{(selectedCertificateCourse?.courseType ?? 'course').replace('_', ' ')}</strong>
                <span>Issue mode</span><strong>{selectedCourseIsDelivery ? 'Manual' : (courseSettings.issueMode ?? 'auto')}</strong>
                <span>Approval</span><strong>{courseSettings.approvalMode ?? 'none'}</strong>
                <span>Reissue</span><strong>{courseSettings.allowReissue ? 'Allowed' : 'Locked'}</strong>
              </div>
              <CountFilterRow
                className="certificate-summary-row"
                ariaLabel="Certificate roster filters"
                items={[
                  { key: 'all', label: 'students', count: rosterCounts.total, active: studentProgressFilter === 'all' },
                  { key: 'eligible', label: 'eligible', count: rosterCounts.eligible, active: studentProgressFilter === 'eligible' },
                  { key: 'blocked', label: 'not eligible', count: rosterCounts.blocked, active: studentProgressFilter === 'blocked' },
                  { key: 'issued', label: 'issued', count: rosterCounts.issued, active: false },
                  { key: 'pending', label: 'pending', count: rosterCounts.pending, active: false },
                ]}
                onSelect={(key) => {
                  if (key === 'eligible' || key === 'blocked' || key === 'all') {
                    setStudentProgressFilter(key);
                  }
                }}
              />
              <div className="three-col certificate-rule-summary">
                <div className="metric-card">
                  <span>Attendance</span>
                  <strong>{courseSettings.eligibilityAttendanceRequired ? `${courseSettings.eligibilityAttendancePercent ?? 80}%` : 'Optional'}</strong>
                </div>
                <div className="metric-card">
                  <span>Homework</span>
                  <strong>{courseSettings.eligibilityHomeworkRequired ? `${courseSettings.eligibilityHomeworkPercent ?? 100}%` : 'Optional'}</strong>
                </div>
                <div className="metric-card">
                  <span>Activities</span>
                  <strong>{courseSettings.eligibilityActivitiesRequired ? `${courseSettings.eligibilityActivitiesPercent ?? 100}%` : 'Optional'}</strong>
                </div>
              </div>
              <aside className="certificate-preview-panel embedded-panel">
                <div className="section-heading-row compact">
                  <div>
                    <h2>Certificate preview</h2>
                    <span>Adjust certificate display values for preview, approval, or manual issue.</span>
                  </div>
                  <div className="certificate-preview-actions">
                    <button type="button" className="secondary-button" disabled={!courseId || !courseSettings || previewing} onClick={() => void loadExactPreview()}>
                      {previewing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button type="button" className="secondary-button" disabled={!exactPreviewHtml} onClick={() => setIsPreviewModalOpen(true)}>
                      Full preview
                    </button>
                  </div>
                </div>
                {renderCertificateDisplayControls()}
                {previewing ? (
                  <div className="certificate-preview-loading">Generated preview loading...</div>
                ) : exactPreviewHtml && !exactPreviewError ? (
                  <iframe title="Generated certificate preview" srcDoc={exactPreviewHtml} scrolling="no" onLoad={handlePreviewFrameLoad('inline')} className={`certificate-preview-frame ${preview.orientation === 'portrait' ? 'portrait' : ''}`} />
                ) : (
                  <div className={`certificate-preview ${preview.orientation === 'portrait' ? 'portrait' : ''}`} style={{ '--certificate-primary': preview.primaryColor, '--certificate-accent': preview.accentColor } as React.CSSProperties}>
                    <div className="certificate-preview-border">
                      <header>
                        {preview.logoUrl ? <img src={preview.logoUrl} alt="" /> : <div className="certificate-preview-logo">{preview.brandName.slice(0, 1)}</div>}
                        <strong>{preview.brandName}</strong>
                      </header>
                      <main>
                        <span>{preview.title}</span>
                        <h3>{previewStudentName || courseStudents[0]?.fullName || 'Student Name'}</h3>
                        <p>has successfully completed</p>
                        <h4>{selectedCertificateCourse?.title || 'Course Title'}</h4>
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
                )}
                {exactPreviewError ? <span className="field-error">{exactPreviewError}</span> : null}
              </aside>
              <div className="section-heading-row compact">
                <div>
                  <h2>Student eligibility</h2>
                  <span>Review course completion before issuing or approving certificates.</span>
                </div>
              </div>
              <div className="filters-row certificate-filters">
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search enrolled students"
                />
                <select value={studentProgressFilter} onChange={(event) => setStudentProgressFilter(event.target.value as 'all' | 'eligible' | 'blocked')}>
                  <option value="all">All students</option>
                  <option value="eligible">Eligible</option>
                  <option value="blocked">Not eligible</option>
                </select>
              </div>
              {studentLoading ? <LoadingState label="Loading certificate roster" /> : null}
              {!studentLoading ? (
                <div className="stack-list">
                  {courseStudents.slice(0, 12).map((student) => (
                    <article key={student.id} className="stack-list-item">
                      <div>
                        <strong>{student.fullName || student.email || `Student ${student.id}`}</strong>
                        <span>
                          <span className={`status-badge ${student.certificateEligibility?.eligible || student.certificateEligible ? 'published' : 'draft'}`}>
                            {student.certificateEligibility?.eligible || student.certificateEligible ? 'Eligible' : 'Not eligible'}
                          </span>
                          {' '}· {student.progressPercent ?? 0}% · {describeEligibility(student)}
                        </span>
                        {student.certificateStatus ? (
                          <span className={`status-badge ${student.certificateStatus}`}>{student.certificateStatus.replace('_', ' ')}</span>
                        ) : null}
                      </div>
                      <div className="certificate-actions">
                        {canIssueCertificates && !student.hasCertificate ? (
                          <button type="button" disabled={issuing} onClick={() => openIssueForStudent(student)}>
                            Issue
                          </button>
                        ) : null}
                        {student.certificateStatus === 'issued' && student.certificateDownloadUrl ? (
                          <button type="button" className="secondary-button" onClick={() => void downloadIssuedCertificate(student.certificateDownloadUrl, student.certificatePublicId)}>
                            Download
                          </button>
                        ) : null}
                        {student.certificateVerificationUrl ? (
                          <a href={student.certificateVerificationUrl} target="_blank" rel="noreferrer">Verify</a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {!courseStudents.length ? <span className="muted-text">No enrolled students match the current filters.</span> : null}
                </div>
              ) : null}

              <h2>Certificates</h2>
              <div className="page-actions">
                {canIssueCertificates || canRegenerateCertificates ? (
                  <>
                    {canIssueCertificates ? (
                      <button type="button" disabled={!courseId || issuing} onClick={() => setIsIssueModalOpen(true)}>
                        Issue certificate
                      </button>
                    ) : null}
                    {canRegenerateCertificates ? (
                      <button type="button" className="secondary-button" disabled={regenerating || !certificates.some((certificate) => certificate.status === 'issued')} onClick={() => void regenerateIssuedCertificates()}>
                        {regenerating ? 'Regenerating...' : 'Regenerate issued PDFs'}
                      </button>
                    ) : null}
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
                      {canApproveCertificates && certificate.status === 'pending_approval' ? (
                        <>
                          <button type="button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'approve')}>Approve</button>
                          <button type="button" className="secondary-button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'reject')}>Reject</button>
                        </>
                      ) : null}
                      {certificate.status === 'issued' ? (
                        <>
                          {certificate.downloadUrl ? (
                            <button type="button" className="secondary-button" onClick={() => void downloadIssuedCertificate(certificate.downloadUrl, certificate.publicId)}>
                              Download
                            </button>
                          ) : null}
                          {certificate.verificationUrl ? <a href={certificate.verificationUrl} target="_blank" rel="noreferrer">Verify</a> : null}
                          {canRegenerateCertificates || canRevokeCertificates ? (
                            <>
                              {canRegenerateCertificates ? <button type="button" className="secondary-button" disabled={regenerating} onClick={() => void regenerateIssuedCertificates(certificate.id)}>Regenerate</button> : null}
                              {canRevokeCertificates ? <button type="button" className="secondary-button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'revoke')}>Revoke</button> : null}
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
      {isPreviewModalOpen ? (
        <Modal labelledBy="certificate-preview-modal-title" className="decision-modal certificate-preview-modal" onClose={() => setIsPreviewModalOpen(false)}>
          <div className="section-heading-row compact">
            <div>
              <span className="status-badge published">{selectedCertificateCourse?.title ?? 'Certificate'}</span>
              <h2 id="certificate-preview-modal-title">Certificate preview</h2>
            </div>
            <button type="button" className="secondary-button" disabled={!courseId || !courseSettings || previewing} onClick={() => void loadExactPreview()}>
              {previewing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {previewing ? (
            <div className="certificate-preview-loading large">Generated preview loading...</div>
          ) : exactPreviewHtml ? (
            <iframe title="Generated certificate preview modal" srcDoc={exactPreviewHtml} scrolling="no" data-preview-surface="modal" onLoad={handlePreviewFrameLoad('modal')} className={`certificate-preview-frame modal-frame ${preview.orientation === 'portrait' ? 'portrait' : ''}`} />
          ) : (
            <EmptyState title="Preview unavailable" detail={exactPreviewError || 'Refresh the preview and try again.'} />
          )}
        </Modal>
      ) : null}
      {isIssueModalOpen && canIssueCertificates ? (
        <FormModal labelledBy="issue-certificate-title" onClose={() => { setIsIssueModalOpen(false); setIssueErrors({}); }} onSubmit={issueCertificate}>
            <div>
              <span className="status-badge published">{courses.find((course) => course.id === courseId)?.title ?? 'Course required'}</span>
              <h2 id="issue-certificate-title">Issue certificate</h2>
              <p>Manually issue a certificate for an eligible learner in this course.</p>
            </div>
            <label>
              Student
              <select
                value={selectedStudentId ?? ''}
                onChange={(event) => {
                  const nextStudentId = Number(event.target.value) || undefined;
                  const nextStudent = courseStudents.find((student) => student.id === nextStudentId || student.userId === nextStudentId);
                  setSelectedStudentId(nextStudentId);
                  setPreviewStudentName(nextStudent?.fullName || nextStudent?.email || '');
                  setIssueErrors((current) => ({ ...current, student: '' }));
                }}
                disabled={!courseStudents.length}
                className={issueErrors.student ? 'input-error' : ''}
                aria-invalid={!!issueErrors.student}
                autoFocus
              >
                <option value="">Select student</option>
                {courseStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName || student.email || `Student ${student.id}`} - {student.certificateEligibility?.eligible || student.certificateEligible ? 'eligible' : 'not eligible'}
                  </option>
                ))}
              </select>
              {issueErrors.student ? <span className="field-error">{issueErrors.student}</span> : null}
            </label>
            {selectedStudent ? (
              <p className="panel-note">
                {selectedStudent.certificateEligibility?.eligible || selectedStudent.certificateEligible
                  ? 'This student currently meets the certificate requirements.'
                  : `Warning: ${describeEligibility(selectedStudent)}. You can still issue after confirming the override.`}
              </p>
            ) : null}
            {renderCertificateDisplayControls('modal-fields')}
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
      {pendingDecision && (canApproveCertificates || canRevokeCertificates) ? (
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
              <>
                <p className="panel-note">This will make the certificate available with the display values below.</p>
                {renderCertificateDisplayControls('modal-fields')}
              </>
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
