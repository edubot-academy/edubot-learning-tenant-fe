import { FormEvent, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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
import { commonStatusLabelKeys, courseTypeLabelKeys, enumLabel } from '../../lib/enumLabels';
import { useAuth } from '../auth/AuthProvider';
import { isTenantAdmin } from '../tenant/tenantRoles';
import {
  certificateTabs,
  describeEligibility,
  filterCertificates,
  filterIssueStudents,
  getCertificateCounts,
  getCertificateDecisionBlocker,
  isStudentEligibleForCertificate,
  validateCourseCertificateSettings,
  validateHexColors,
  type CertificateLanguageValue,
  type CertificateOrientationValue,
  type CertificateTab,
} from './certificateWorkflow';

type CertificateDecision = {
  certificate: CourseCertificate;
  action: 'approve' | 'reject' | 'revoke';
};

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
  const { t } = useTranslation();
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
  const [issueStudentQuery, setIssueStudentQuery] = useState('');
  const [issueStudentFilter, setIssueStudentFilter] = useState<'all' | 'eligible' | 'blocked'>('eligible');
  const [pendingIssueOverride, setPendingIssueOverride] = useState<GroupStudent | null>(null);
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
  const [pendingRegenerate, setPendingRegenerate] = useState<{ certificateId?: number; count: number } | null>(null);
  const [registryPreviewOpen, setRegistryPreviewOpen] = useState(false);
  const [expandedCertificateId, setExpandedCertificateId] = useState<number | undefined>();
  const [visibleStudentLimit, setVisibleStudentLimit] = useState(12);
  const [visibleCertificateLimit, setVisibleCertificateLimit] = useState(12);
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
  const searchParamsString = searchParams.toString();
  const languageLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      en: t('language.en'),
      ky: t('language.ky'),
      ru: t('language.ru'),
    };
    return labels[value || ''] ?? t('certificates.tenantDefault');
  };
  const orientationLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      landscape: t('certificates.landscape'),
      portrait: t('certificates.portrait'),
    };
    return labels[value || ''] ?? t('certificates.tenantDefault');
  };
  const issueModeLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      auto: t('certificates.auto'),
      manual: t('certificates.manual'),
    };
    return labels[value || ''] ?? enumLabel(value ?? 'auto', {}, t);
  };
  const courseTypeLabel = (value?: Course['courseType'] | string | null) => {
    return value ? enumLabel(value, courseTypeLabelKeys, t) : t('courses.course');
  };
  const approvalModeLabel = (value?: CourseCertificateSettings['approvalMode'] | null) => {
    if (value === 'admin') return t('certificates.ownerCompanyAdmin');
    if (value === 'instructor') return t('members.roleInstructor');
    return t('certificates.none');
  };
  const certificateStatusLabel = (value?: string | null) => {
    return enumLabel(value, {
      ...commonStatusLabelKeys,
      all: 'attendance.allStatuses',
    }, t);
  };
  const eligibilityLabel = (student?: GroupStudent | null) => (
    isStudentEligibleForCertificate(student) ? t('certificates.eligible') : t('certificates.notEligible')
  );
  const studentFallback = (id?: number | null) => t('courses.studentFallback', { id: id ?? 0 });
  const translateEligibility = (value: string) => {
    const labels: Record<string, string> = {
      Eligible: t('certificates.eligible'),
      'Eligibility unavailable': t('certificates.eligibilityUnavailable'),
      'Requirements not met': t('certificates.requirementsNotMet'),
      'No delivery sessions exist yet': t('certificates.reasonSessionsMissing'),
      'Sessions are not completed': t('certificates.reasonSessionsIncomplete'),
      'Attendance is below requirement': t('certificates.reasonAttendanceBelow'),
      'Homework is below requirement': t('certificates.reasonHomeworkBelow'),
      'Activities are below requirement': t('certificates.reasonActivitiesBelow'),
      'Lesson progress is incomplete': t('certificates.reasonLessonProgressIncomplete'),
    };
    return value.split(', ').map((part) => labels[part] ?? part).join(', ');
  };
  const validationMessage = (value?: string) => {
    if (!value) return '';
    const labels: Record<string, string> = {
      'Use a 6-digit hex color, for example #122144.': t('certificates.errorHexColor'),
      'Attendance must be between 0 and 100.': t('certificates.errorAttendanceRange'),
      'Homework must be between 0 and 100.': t('certificates.errorHomeworkRange'),
      'Activities must be between 0 and 100.': t('certificates.errorActivitiesRange'),
      'Reason is required.': t('certificates.reasonRequired'),
      'Choose a signature image to upload.': t('certificates.chooseSignature'),
      'Choose a secondary brand logo to upload.': t('certificates.chooseSecondaryLogo'),
      'Could not upload secondary logo.': t('certificates.secondaryLogoUploadFailed'),
      'Select a student before issuing a certificate.': t('certificates.selectStudentBeforeIssue'),
    };
    return labels[value] ?? value;
  };
  const translatedCertificateTabs = useMemo(() => certificateTabs.map((tab) => ({
    key: tab.key,
    label: tab.key === 'branding' ? t('settings.tabBranding') : tab.key === 'rules' ? t('certificates.courseRules') : t('certificates.registry'),
    description: tab.key === 'branding' ? t('certificates.brandingTabDetail') : tab.key === 'rules' ? t('certificates.rulesTabDetail') : t('certificates.registryTabDetail'),
  })), [t]);
  const visibleCertificateTabs = useMemo(
    () => canManageCertificateAdmin ? translatedCertificateTabs : translatedCertificateTabs.filter((tab) => tab.key === 'registry'),
    [canManageCertificateAdmin, translatedCertificateTabs],
  );

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
        if (!cancelled) toast.error(t('certificates.brandingLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, t]);

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
        const message = error?.response?.data?.message || t('certificates.courseSettingsLoadFailed');
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setCourseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, t]);

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
          if (!cancelled) toast.error(t('certificates.rosterLoadFailed'));
        })
        .finally(() => {
          if (!cancelled) setStudentLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [certificateTab, courseId, studentProgressFilter, studentSearch, t]);

  const preview = useMemo(() => ({
    brandName: branding?.primaryBrandName || activeTenant?.name || t('settings.tenantNamePlaceholder'),
    logoUrl: branding?.primaryBrandLogoUrl || activeTenant?.logoUrl || null,
    title: branding?.certificateTitle || t('certificates.certificateOfCompletion'),
    issuerName: previewIssuerName || branding?.issuerDisplayName || activeTenant?.name || t('certificates.issuerName'),
    issuerTitle: previewIssuerTitle || branding?.issuerTitle || t('members.roleInstructor'),
    primaryColor: branding?.primaryColor || '#122144',
    accentColor: branding?.accentColor || '#f17e22',
    language: previewLanguage,
    orientation: previewOrientation,
  }), [activeTenant?.logoUrl, activeTenant?.name, branding, previewIssuerName, previewIssuerTitle, previewLanguage, previewOrientation, t]);

  const certificateStatuses = useMemo(() => {
    const statuses = Array.from(new Set(certificates.map((certificate) => certificate.status).filter(Boolean)));
    return ['all', ...statuses];
  }, [certificates]);

  const certificateCounts = useMemo(() => (
    getCertificateCounts(certificates)
  ), [certificates]);

  const selectedStudent = useMemo(
    () => courseStudents.find((student) => student.id === selectedStudentId || student.userId === selectedStudentId),
    [courseStudents, selectedStudentId],
  );
  const issueStudentOptions = useMemo(() => {
    return filterIssueStudents(courseStudents, issueStudentQuery, issueStudentFilter);
  }, [courseStudents, issueStudentFilter, issueStudentQuery]);
  const visibleCourseStudents = useMemo(
    () => courseStudents.slice(0, visibleStudentLimit),
    [courseStudents, visibleStudentLimit],
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
    const eligible = courseStudents.filter((student) => isStudentEligibleForCertificate(student)).length;
    return {
      total: courseStudents.length,
      eligible,
      blocked: Math.max(0, courseStudents.length - eligible),
      issued: courseStudents.filter((student) => student.certificateStatus === 'issued' || student.hasCertificate).length,
      pending: courseStudents.filter((student) => student.certificateStatus === 'pending_approval').length,
    };
  }, [courseStudents]);
  const issuedCertificateCount = certificates.filter((certificate) => certificate.status === 'issued').length;

  useEffect(() => {
    if (!branding && !activeTenant) return;
    setPreviewIssuerName(user?.fullName || branding?.issuerDisplayName || activeTenant?.name || '');
    setPreviewIssuerTitle(branding?.issuerTitle || (canManageCertificateAdmin ? t('members.roleCompanyAdmin') : t('members.roleInstructor')));
    setPreviewLanguage(
      branding?.certificateLanguage === 'ru' || branding?.certificateLanguage === 'ky' ? branding.certificateLanguage : 'en',
    );
    setPreviewOrientation(branding?.pageOrientation === 'portrait' ? 'portrait' : 'landscape');
  }, [activeTenant, branding, canManageCertificateAdmin, courseId, user?.fullName, t]);

  useEffect(() => {
    const nextStudentName = selectedStudent?.fullName || selectedStudent?.email || courseStudents[0]?.fullName || courseStudents[0]?.email || '';
    setPreviewStudentName(nextStudentName);
  }, [courseId, courseStudents, selectedStudent]);

  useEffect(() => {
    setVisibleStudentLimit(12);
  }, [courseId, studentProgressFilter, studentSearch]);

  useEffect(() => {
    setVisibleCertificateLimit(12);
    setExpandedCertificateId(undefined);
  }, [certificateQuery, certificateStatus, courseId]);

  const filteredCertificates = useMemo(() => {
    return filterCertificates(certificates, certificateQuery, certificateStatus);
  }, [certificateQuery, certificateStatus, certificates]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenant || !branding) return;
    const nextErrors = validateHexColors({
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
    });
    if (Object.keys(nextErrors).length) {
      setBrandingErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, value]) => [key, validationMessage(value)])));
      toast.error(validationMessage(nextErrors.primaryColor ?? nextErrors.accentColor));
      return;
    }

    setBrandingErrors({});
    setSaving(true);
    try {
      const saved = await updateCertificateBranding(activeTenant.id, branding);
      setBranding(saved);
      toast.success(t('certificates.brandingSaved'));
    } catch {
      toast.error(t('certificates.brandingSaveFailed'));
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
      toast.success(t('certificates.logoUploaded'));
    } catch {
      toast.error(t('certificates.logoUploadFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveCourseSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseId || !courseSettings) return;
    const nextErrors = validateCourseCertificateSettings(courseSettings);
    if (Object.keys(nextErrors).length) {
      setCourseSettingsErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, value]) => [key, validationMessage(value)])));
      toast.error(validationMessage(nextErrors.primaryColor ?? nextErrors.accentColor ?? nextErrors.attendance ?? nextErrors.homework ?? nextErrors.activities));
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
      toast.success(t('certificates.courseSettingsSaved'));
    } catch {
      toast.error(t('certificates.courseSettingsSaveFailed'));
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
        previewStudentName: previewStudentName.trim() || courseStudents[0]?.fullName || t('certificates.studentName'),
        previewCourseTitle: selectedCertificateCourse?.title ?? t('certificates.courseTitle'),
        previewIssuerName: previewIssuerName.trim() || branding.issuerDisplayName || activeTenant?.name || t('certificates.issuerName'),
        previewIssuerTitle: previewIssuerTitle.trim() || branding.issuerTitle || t('members.roleInstructor'),
        previewIssuedAt: new Date().toISOString(),
      });
      setExactPreviewHtml(normalizeExactPreviewHtml(html));
    } catch {
      setExactPreviewError(t('certificates.previewLoadFailed'));
      toast.error(t('certificates.previewLoadFailed'));
    } finally {
      setPreviewing(false);
    }
  }, [activeTenant?.name, branding, courseId, courseSettings, courseStudents, previewIssuerName, previewIssuerTitle, previewLanguage, previewOrientation, previewStudentName, selectedCertificateCourse?.title, t]);

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
      setCourseSettingsErrors((current) => ({ ...current, signature: t('certificates.chooseSignature') }));
      toast.error(t('certificates.chooseSignature'));
      return;
    }
    setCourseSettingsErrors((current) => ({ ...current, signature: '' }));
    setSaving(true);
    try {
      const saved = await uploadCourseCertificateSignature(courseId, file);
      setCourseSettings(saved);
      toast.success(t('certificates.signatureUploaded'));
    } catch {
      toast.error(t('certificates.signatureUploadFailed'));
    } finally {
      setSaving(false);
    }
  };

  const uploadSecondaryLogo = async (file?: File) => {
    if (!courseId || !file) {
      setCourseSettingsErrors((current) => ({ ...current, secondaryLogo: t('certificates.chooseSecondaryLogo') }));
      toast.error(t('certificates.chooseSecondaryLogo'));
      return;
    }
    setCourseSettingsErrors((current) => ({ ...current, secondaryLogo: '' }));
    setSaving(true);
    try {
      const saved = await uploadCourseCertificateSecondaryLogo(courseId, file);
      setCourseSettings(saved);
      toast.success(t('certificates.secondaryLogoUploaded'));
    } catch {
      setCourseSettingsErrors((current) => ({ ...current, secondaryLogo: t('certificates.secondaryLogoUploadFailed') }));
      toast.error(t('certificates.secondaryLogoUploadFailed'));
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
      toast.error(t('certificates.downloadFailed'));
    }
  };

  const resetIssueModalState = () => {
    setSelectedStudentId(undefined);
    setPreviewStudentName('');
    setCertificateNote('');
    setIssueStudentQuery('');
    setIssueStudentFilter('eligible');
    setPendingIssueOverride(null);
    setIssueErrors({});
  };

  const openIssueModal = () => {
    resetIssueModalState();
    setIsIssueModalOpen(true);
  };

  const closeIssueModal = () => {
    setIsIssueModalOpen(false);
    resetIssueModalState();
  };

  const openIssueForStudent = (student: GroupStudent) => {
    resetIssueModalState();
    setSelectedStudentId(student.id);
    setPreviewStudentName(student.fullName || student.email || '');
    setIssueStudentFilter(isStudentEligibleForCertificate(student) ? 'eligible' : 'blocked');
    setIsIssueModalOpen(true);
  };

  const submitIssueCertificate = async (allowEligibilityOverride = false) => {
    if (!courseId || !selectedStudentId || !branding) {
      return;
    }

    const activeCourseId = courseId!;
    const selectedStudent = selectedStudentId!;
    const student = courseStudents.find((item) => item.id === selectedStudent || item.userId === selectedStudent);
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
      setPendingIssueOverride(null);
      setIssueErrors({});
      toast.success(t('certificates.issued'));
    } catch {
      toast.error(t('certificates.issueFailed'));
    } finally {
      setIssuing(false);
    }
  };

  const issueCertificate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!courseId || !selectedStudentId || !branding) {
      nextErrors.student = t('certificates.selectStudentBeforeIssue');
    }
    if (Object.keys(nextErrors).length) {
      setIssueErrors(nextErrors);
      toast.error(nextErrors.student);
      return;
    }

    setIssueErrors({});
    const student = courseStudents.find((item) => item.id === selectedStudentId || item.userId === selectedStudentId);
    if (!isStudentEligibleForCertificate(student)) {
      setPendingIssueOverride(student ?? null);
      return;
    }
    await submitIssueCertificate(false);
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

    const blocker = getCertificateDecisionBlocker(action, decisionReason);
    if (blocker) {
      toast.error(validationMessage(blocker));
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
      toast.success(t(`certificates.${action}Success`));
      setPendingDecision(null);
      setDecisionReason('');
    } catch {
      toast.error(t(`certificates.${action}Failed`));
    } finally {
      setDecisionId(null);
    }
  };

  const requestRegenerateIssuedCertificates = (certificateId?: number) => {
    setPendingRegenerate({
      certificateId,
      count: certificateId ? 1 : issuedCertificateCount,
    });
  };

  const regenerateIssuedCertificates = async (certificateId?: number) => {
    if (!courseId) return;
    setRegenerating(true);
    try {
      const result = await regenerateCourseCertificates(courseId, certificateId);
      await reloadCourseCertificates(courseId);
      await reloadCertificateRoster(courseId);
      toast.success(t('certificates.regeneratedCount', { count: result.regeneratedCount }));
      setPendingRegenerate(null);
    } catch {
      toast.error(t('certificates.regenerateFailed'));
    } finally {
      setRegenerating(false);
    }
  };

  const renderCertificateDisplayControls = (className = '') => (
    <div className={`certificate-display-controls ${className}`}>
      <label>
        {t('certificates.studentName')}
        <input
          value={previewStudentName}
          onChange={(event) => setPreviewStudentName(event.target.value)}
          placeholder={selectedStudent?.fullName || t('certificates.studentName')}
        />
      </label>
      <label>
        {t('certificates.issuerName')}
        <input
          value={previewIssuerName}
          onChange={(event) => setPreviewIssuerName(event.target.value)}
          placeholder={user?.fullName || activeTenant?.name || t('certificates.issuerName')}
        />
      </label>
      <label>
        {t('certificates.issuerTitle')}
        <input
          value={previewIssuerTitle}
          onChange={(event) => setPreviewIssuerTitle(event.target.value)}
          placeholder={t('members.roleInstructor')}
        />
      </label>
      <label>
        {t('settings.locale')}
        <select value={previewLanguage} onChange={(event) => setPreviewLanguage(event.target.value as CertificateLanguageValue)}>
          <option value="en">{t('language.en')}</option>
          <option value="ru">{t('language.ru')}</option>
          <option value="ky">{t('language.ky')}</option>
        </select>
      </label>
      <label>
        {t('certificates.certificateMode')}
        <select value={previewOrientation} onChange={(event) => setPreviewOrientation(event.target.value as CertificateOrientationValue)}>
          <option value="landscape">{t('certificates.landscape')}</option>
          <option value="portrait">{t('certificates.portrait')}</option>
        </select>
      </label>
    </div>
  );

  if (loading) return <LoadingState label={t('certificates.loadingBranding')} />;
  if (!branding) return <EmptyState title={t('certificates.brandingUnavailable')} />;

  return (
    <>
      <PageHeader
        title={t('navigation.certificates')}
        eyebrow={activeTenant?.name}
        actions={certificateTab === 'branding' && canManageCertificateAdmin ? <button type="submit" form="certificate-branding-form" disabled={saving}>{saving ? t('courses.saving') : t('settings.saveBranding')}</button> : null}
      />
      <WorkspaceTabs
        tabs={visibleCertificateTabs}
        activeTab={certificateTab}
        onChange={setCertificateTab}
        ariaLabel={t('certificates.workspace')}
        className="certificate-workspace-tabs"
      />
      {certificateTab === 'branding' ? (
      <div className="workspace-grid certificate-workspace">
        <form id="certificate-branding-form" className="settings-grid certificate-settings-grid" onSubmit={onSubmit}>
          <section className="settings-panel">
            <h2>{t('certificates.primaryBrand')}</h2>
            <label>
              {t('certificates.nameOnCertificate')}
              <input disabled={!canManageCertificateAdmin} value={branding.primaryBrandName ?? ''} onChange={(event) => setBranding({ ...branding, primaryBrandName: event.target.value })} placeholder={activeTenant?.name ?? t('settings.tenantNamePlaceholder')} />
            </label>
            <label>
              {t('certificates.certificateTitle')}
              <input disabled={!canManageCertificateAdmin} value={branding.certificateTitle ?? ''} onChange={(event) => setBranding({ ...branding, certificateTitle: event.target.value })} placeholder={t('certificates.certificateOfCompletion')} />
            </label>
            <label>
              {t('certificates.issuerName')}
              <input disabled={!canManageCertificateAdmin} value={branding.issuerDisplayName ?? ''} onChange={(event) => setBranding({ ...branding, issuerDisplayName: event.target.value })} placeholder={activeTenant?.name ?? t('certificates.issuerName')} />
            </label>
            <label>
              {t('certificates.issuerTitle')}
              <input disabled={!canManageCertificateAdmin} value={branding.issuerTitle ?? ''} onChange={(event) => setBranding({ ...branding, issuerTitle: event.target.value })} placeholder={t('members.roleInstructor')} />
            </label>
          </section>

          <section className="settings-panel">
            <h2>{t('certificates.logoStyle')}</h2>
            <div className="logo-preview">
              {preview.logoUrl ? <img src={preview.logoUrl} alt="" /> : <span>{t('settings.noLogoUploaded')}</span>}
            </div>
            <label>
              {t('settings.uploadLogo')}
              <input disabled={!canManageCertificateAdmin} type="file" accept="image/*" onChange={(event) => void onLogoChange(event.target.files?.[0])} />
            </label>
            <div className="two-col">
              <label>
                {t('settings.primaryColor')}
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
                {t('settings.accentColor')}
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
                {t('settings.locale')}
                <select disabled={!canManageCertificateAdmin} value={branding.certificateLanguage ?? ''} onChange={(event) => setBranding({ ...branding, certificateLanguage: event.target.value })}>
                  <option value="">{t('certificates.tenantDefault')}</option>
                  <option value="en">{t('language.en')}</option>
                  <option value="ru">{t('language.ru')}</option>
                  <option value="ky">{t('language.ky')}</option>
                </select>
              </label>
              <label>
                {t('certificates.page')}
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
                  <option value="">{t('certificates.tenantDefault')}</option>
                  <option value="landscape">{t('certificates.landscape')}</option>
                  <option value="portrait">{t('certificates.portrait')}</option>
                </select>
              </label>
            </div>
          </section>
        </form>

        <aside className="settings-panel certificate-preview-panel workflow-context-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>{t('certificates.preview')}</h2>
              <span>{t('certificates.previewDetail')}</span>
            </div>
          </div>
          <div className="certificate-course-context">
            <label>
              {t('certificates.previewCourse')}
              <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>
            <p className="panel-note">{t('certificates.previewCourseNote')}</p>
          </div>
          <div className="certificate-preview-actions">
            <button type="button" className="secondary-button" disabled={!courseId || !courseSettings || previewing} onClick={() => void loadExactPreview()}>
              {previewing ? t('certificates.refreshing') : t('certificates.refreshPreview')}
            </button>
            <button type="button" className="secondary-button" disabled={!exactPreviewHtml} onClick={() => setIsPreviewModalOpen(true)}>
              {t('certificates.fullPreview')}
            </button>
          </div>
          {previewing ? (
            <div className="certificate-preview-loading">{t('certificates.generatedPreviewLoading')}</div>
          ) : exactPreviewHtml && !exactPreviewError ? (
            <iframe title={t('certificates.generatedPreviewTitle')} srcDoc={exactPreviewHtml} scrolling="no" onLoad={handlePreviewFrameLoad('inline')} className={`certificate-preview-frame ${preview.orientation === 'portrait' ? 'portrait' : ''}`} />
          ) : (
            <div className={`certificate-preview ${preview.orientation === 'portrait' ? 'portrait' : ''}`} style={{ '--certificate-primary': preview.primaryColor, '--certificate-accent': preview.accentColor } as React.CSSProperties}>
              <div className="certificate-preview-border">
                <header>
                  {preview.logoUrl ? <img src={preview.logoUrl} alt="" /> : <div className="certificate-preview-logo">{preview.brandName.slice(0, 1)}</div>}
                  <strong>{preview.brandName}</strong>
                </header>
                <main>
                  <span>{preview.title}</span>
                  <h3>{t('certificates.studentName')}</h3>
                  <p>{t('certificates.completedText')}</p>
                  <h4>{t('certificates.courseTitle')}</h4>
                </main>
                <footer>
                  <div>
                    <span>{t('certificates.issuedLabel')}</span>
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
            <span>{t('settings.locale')}</span><strong>{languageLabel(preview.language)}</strong>
            <span>{t('certificates.orientation')}</span><strong>{orientationLabel(preview.orientation)}</strong>
          </div>
        </aside>
      </div>
      ) : null}

      {certificateTab !== 'branding' ? (
      <section className="settings-panel full certificate-course-panel workflow-context-panel">
        <div className="section-heading-row">
          <div>
            <h2>{certificateTab === 'rules' ? t('certificates.courseCertificateRules') : t('certificates.registry')}</h2>
            <span>{visibleCertificateTabs.find((tab) => tab.key === certificateTab)?.description}</span>
          </div>
        </div>
        <div className="filters-row">
          <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
            <option value="">{t('courses.selectCourse')}</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </div>

        {courseLoading ? <LoadingState label={t('certificates.loadingCourseCertificates')} /> : null}
        {!courseLoading && !courseSettings ? (
          <EmptyState
            title={t('courses.selectCourse')}
            detail={t('certificates.selectCourseDetail')}
            action={<Link className="secondary-link-button" to="/courses">{t('certificates.reviewCourses')}</Link>}
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
                  {t('certificates.enableCertificates')}
                </label>
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCertificateAdmin}
                    type="checkbox"
                    checked={courseSettings.allowReissue ?? false}
                    onChange={(event) => setCourseSettings({ ...courseSettings, allowReissue: event.target.checked })}
                  />
                  {t('certificates.allowReissue')}
                </label>
              </div>
              <div className="two-col">
                <label>
                  {t('certificates.issueMode')}
                  <select disabled={!canManageCourseRules || selectedCourseIsDelivery} value={selectedCourseIsDelivery ? 'manual' : courseSettings.issueMode ?? 'auto'} onChange={(event) => setCourseSettings({ ...courseSettings, issueMode: event.target.value as 'manual' | 'auto' })}>
                    {!selectedCourseIsDelivery ? <option value="auto">{t('certificates.auto')}</option> : null}
                    <option value="manual">{t('certificates.manual')}</option>
                  </select>
                  {selectedCourseIsDelivery ? <span className="muted-text">{t('certificates.deliveryManualOnly')}</span> : null}
                </label>
                <label>
                  {t('certificates.approval')}
                  <select disabled={!canManageCourseRules} value={courseSettings.approvalMode ?? 'none'} onChange={(event) => setCourseSettings({ ...courseSettings, approvalMode: event.target.value as 'none' | 'instructor' | 'admin' })}>
                    <option value="none">{t('certificates.none')}</option>
                    <option value="instructor">{t('members.roleInstructor')}</option>
                    <option value="admin">{t('certificates.ownerCompanyAdmin')}</option>
                  </select>
                </label>
              </div>
              <label>
                {t('certificates.certificateTitle')}
                <input disabled={!canManageCourseRules} value={courseSettings.certificateTitle ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, certificateTitle: event.target.value })} placeholder={branding.certificateTitle || t('certificates.certificateOfAchievement')} />
              </label>
              <label>
                {t('certificates.secondaryBrand')}
                <input disabled={!canManageCourseRules} value={courseSettings.secondaryBrandName ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, secondaryBrandName: event.target.value })} placeholder={t('certificates.partnerSponsorName')} />
              </label>
              <label>
                {t('certificates.signatureImage')}
                <input disabled={!canManageCourseRules} type="file" accept="image/*" onChange={(event) => void uploadSignature(event.target.files?.[0])} />
                {courseSettingsErrors.signature ? <span className="field-error">{courseSettingsErrors.signature}</span> : null}
                {courseSettings.signatureAssetUrl ? <span className="muted-text">{t('certificates.signatureUploaded')}</span> : null}
              </label>
              <label>
                {t('certificates.secondaryBrandLogo')}
                <input disabled={!canManageCourseRules} type="file" accept="image/*" onChange={(event) => void uploadSecondaryLogo(event.target.files?.[0])} />
                {courseSettingsErrors.secondaryLogo ? <span className="field-error">{courseSettingsErrors.secondaryLogo}</span> : null}
                {courseSettings.secondaryBrandLogoUrl ? <span className="muted-text">{t('certificates.secondaryLogoUploaded')}</span> : null}
              </label>
              <div className="two-col">
                <label>
                  {t('certificates.certificateLanguage')}
                  <select disabled={!canManageCourseRules} value={courseSettings.certificateLanguage ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, certificateLanguage: (event.target.value || null) as CourseCertificateSettings['certificateLanguage'] })}>
                    <option value="">{t('certificates.tenantDefault')}</option>
                    <option value="en">{t('language.en')}</option>
                    <option value="ru">{t('language.ru')}</option>
                    <option value="ky">{t('language.ky')}</option>
                  </select>
                </label>
                <label>
                  {t('certificates.certificateMode')}
                  <select disabled={!canManageCourseRules} value={courseSettings.pageOrientation ?? ''} onChange={(event) => setCourseSettings({ ...courseSettings, pageOrientation: (event.target.value || null) as CourseCertificateSettings['pageOrientation'] })}>
                    <option value="">{t('certificates.tenantDefault')}</option>
                    <option value="landscape">{t('certificates.landscape')}</option>
                    <option value="portrait">{t('certificates.portrait')}</option>
                  </select>
                </label>
              </div>
              <div className="two-col">
                <label>
                  {t('settings.primaryColor')}
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
                  {t('settings.accentColor')}
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
                  {t('certificates.requireAttendance')}
                </label>
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCourseRules}
                    type="checkbox"
                    checked={courseSettings.eligibilityHomeworkRequired ?? false}
                    onChange={(event) => setCourseSettings({ ...courseSettings, eligibilityHomeworkRequired: event.target.checked })}
                  />
                  {t('certificates.requireHomework')}
                </label>
                <label className="checkbox-row">
                  <input
                    disabled={!canManageCourseRules}
                    type="checkbox"
                    checked={courseSettings.eligibilityActivitiesRequired ?? false}
                    onChange={(event) => setCourseSettings({ ...courseSettings, eligibilityActivitiesRequired: event.target.checked })}
                  />
                  {t('certificates.requireActivities')}
                </label>
              </div>
              <div className="three-col">
                <label>
                  {t('certificates.attendancePercent')}
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
                  {t('certificates.homeworkPercent')}
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
                  {t('certificates.activitiesPercent')}
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
              {canManageCourseRules ? <button type="submit" disabled={saving}>{saving ? t('courses.saving') : t('certificates.saveCourseSettings')}</button> : null}
            </form>
            ) : null}

            {certificateTab === 'registry' ? (
            <div className="settings-panel embedded-panel workflow-context-panel compact">
              <div className="section-heading-row compact">
                <div>
                  <h2>{t('certificates.courseCertificateWorkspace')}</h2>
                  <span>{selectedCertificateCourse?.title ?? t('courses.selectCourse')}</span>
                </div>
              </div>
              <div className="definition-grid">
                <span>{t('courses.type')}</span><strong>{courseTypeLabel(selectedCertificateCourse?.courseType)}</strong>
                <span>{t('certificates.issueMode')}</span><strong>{selectedCourseIsDelivery ? t('certificates.manual') : issueModeLabel(courseSettings.issueMode ?? 'auto')}</strong>
                <span>{t('certificates.approval')}</span><strong>{approvalModeLabel(courseSettings.approvalMode)}</strong>
                <span>{t('certificates.reissue')}</span><strong>{courseSettings.allowReissue ? t('certificates.allowed') : t('certificates.locked')}</strong>
              </div>
              <CountFilterRow
                className="certificate-summary-row"
                ariaLabel={t('certificates.rosterFilters')}
                items={[
                  { key: 'all', label: t('courses.studentsLower'), count: rosterCounts.total, active: studentProgressFilter === 'all' },
                  { key: 'eligible', label: t('certificates.eligible'), count: rosterCounts.eligible, active: studentProgressFilter === 'eligible' },
                  { key: 'blocked', label: t('certificates.notEligible'), count: rosterCounts.blocked, active: studentProgressFilter === 'blocked' },
                  { key: 'issued', label: t('certificates.statusIssued'), count: rosterCounts.issued, active: false },
                  { key: 'pending', label: t('overview.pending'), count: rosterCounts.pending, active: false },
                ]}
                onSelect={(key) => {
                  if (key === 'eligible' || key === 'blocked' || key === 'all') {
                    setStudentProgressFilter(key);
                  }
                }}
              />
              <div className="three-col certificate-rule-summary">
                <div className="metric-card">
                  <span>{t('navigation.attendance')}</span>
                  <strong>{courseSettings.eligibilityAttendanceRequired ? `${courseSettings.eligibilityAttendancePercent ?? 80}%` : t('certificates.optional')}</strong>
                </div>
                <div className="metric-card">
                  <span>{t('navigation.homework')}</span>
                  <strong>{courseSettings.eligibilityHomeworkRequired ? `${courseSettings.eligibilityHomeworkPercent ?? 100}%` : t('certificates.optional')}</strong>
                </div>
                <div className="metric-card">
                  <span>{t('certificates.activities')}</span>
                  <strong>{courseSettings.eligibilityActivitiesRequired ? `${courseSettings.eligibilityActivitiesPercent ?? 100}%` : t('certificates.optional')}</strong>
                </div>
              </div>
              <div className="certificate-registry-tools">
                <button type="button" className="secondary-button" onClick={() => setRegistryPreviewOpen((current) => !current)}>
                  {registryPreviewOpen ? t('certificates.hidePreview') : t('certificates.previewCertificate')}
                </button>
                <span>{t('certificates.registryPreviewNote')}</span>
              </div>
              {registryPreviewOpen ? (
              <aside className="certificate-preview-panel embedded-panel">
                <div className="section-heading-row compact">
                  <div>
                    <h2>{t('certificates.certificatePreview')}</h2>
                    <span>{t('certificates.displayValuesDetail')}</span>
                  </div>
                  <div className="certificate-preview-actions">
                    <button type="button" className="secondary-button" disabled={!courseId || !courseSettings || previewing} onClick={() => void loadExactPreview()}>
                      {previewing ? t('certificates.refreshing') : t('actions.refresh')}
                    </button>
                    <button type="button" className="secondary-button" disabled={!exactPreviewHtml} onClick={() => setIsPreviewModalOpen(true)}>
                      {t('certificates.fullPreview')}
                    </button>
                  </div>
                </div>
                {renderCertificateDisplayControls()}
                {previewing ? (
                  <div className="certificate-preview-loading">{t('certificates.generatedPreviewLoading')}</div>
                ) : exactPreviewHtml && !exactPreviewError ? (
                  <iframe title={t('certificates.generatedPreviewTitle')} srcDoc={exactPreviewHtml} scrolling="no" onLoad={handlePreviewFrameLoad('inline')} className={`certificate-preview-frame ${preview.orientation === 'portrait' ? 'portrait' : ''}`} />
                ) : (
                  <div className={`certificate-preview ${preview.orientation === 'portrait' ? 'portrait' : ''}`} style={{ '--certificate-primary': preview.primaryColor, '--certificate-accent': preview.accentColor } as React.CSSProperties}>
                    <div className="certificate-preview-border">
                      <header>
                        {preview.logoUrl ? <img src={preview.logoUrl} alt="" /> : <div className="certificate-preview-logo">{preview.brandName.slice(0, 1)}</div>}
                        <strong>{preview.brandName}</strong>
                      </header>
                      <main>
                        <span>{preview.title}</span>
                        <h3>{previewStudentName || courseStudents[0]?.fullName || t('certificates.studentName')}</h3>
                        <p>{t('certificates.completedText')}</p>
                        <h4>{selectedCertificateCourse?.title || t('certificates.courseTitle')}</h4>
                      </main>
                      <footer>
                        <div>
                          <span>{t('certificates.issuedLabel')}</span>
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
              ) : null}
              <div className="certificate-registry-grid">
              <section className="certificate-registry-section">
              <div className="section-heading-row compact">
                <div>
                  <h2>{t('certificates.studentEligibility')}</h2>
                  <span>{t('certificates.studentEligibilityDetail')}</span>
                </div>
              </div>
              <div className="filters-row certificate-filters">
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder={t('certificates.searchEnrolledStudents')}
                />
                <select value={studentProgressFilter} onChange={(event) => setStudentProgressFilter(event.target.value as 'all' | 'eligible' | 'blocked')}>
                  <option value="all">{t('certificates.allStudents')}</option>
                  <option value="eligible">{t('certificates.eligible')}</option>
                  <option value="blocked">{t('certificates.notEligible')}</option>
                </select>
              </div>
              {studentLoading ? <LoadingState label={t('certificates.loadingRoster')} /> : null}
              {!studentLoading ? (
                <div className="stack-list">
                  {visibleCourseStudents.map((student) => (
                    <article key={student.id} className="stack-list-item">
                      <div>
                        <strong>{student.fullName || student.email || studentFallback(student.id)}</strong>
                        <span>
                          <span className={`status-badge ${isStudentEligibleForCertificate(student) ? 'published' : 'draft'}`}>
                            {eligibilityLabel(student)}
                          </span>
                          {' '}· {student.progressPercent ?? 0}% · {translateEligibility(describeEligibility(student))}
                        </span>
                        {student.certificateStatus ? (
                          <span className={`status-badge ${student.certificateStatus}`}>{certificateStatusLabel(student.certificateStatus)}</span>
                        ) : null}
                      </div>
                      <div className="certificate-actions">
                        {canIssueCertificates && !student.hasCertificate ? (
                          <button type="button" disabled={issuing} onClick={() => openIssueForStudent(student)}>
                            {t('certificates.issue')}
                          </button>
                        ) : null}
                        {student.certificateStatus === 'issued' && student.certificateDownloadUrl ? (
                          <button type="button" className="secondary-button" onClick={() => void downloadIssuedCertificate(student.certificateDownloadUrl, student.certificatePublicId)}>
                            {t('student.download')}
                          </button>
                        ) : null}
                        {student.certificateVerificationUrl ? (
                          <a href={student.certificateVerificationUrl} target="_blank" rel="noreferrer">{t('student.verify')}</a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {!courseStudents.length ? (
                    <EmptyState
                      title={t('certificates.noEnrolledStudentsTitle')}
                      detail={t('certificates.noEnrolledStudentsDetail')}
                    />
                  ) : null}
                  {courseStudents.length > visibleStudentLimit ? (
                    <button type="button" className="secondary-button" onClick={() => setVisibleStudentLimit((current) => current + 12)}>
                      {t('certificates.showMoreStudents')}
                    </button>
                  ) : null}
                </div>
              ) : null}
              </section>

              <section className="certificate-registry-section">
              <h2>{t('navigation.certificates')}</h2>
              <div className="page-actions">
                {canIssueCertificates || canRegenerateCertificates ? (
                  <>
                    {canIssueCertificates ? (
                          <button type="button" className="primary-button" disabled={!courseId || issuing} onClick={openIssueModal}>
                            {t('certificates.issueCertificate')}
                          </button>
                    ) : null}
                    {canRegenerateCertificates ? (
                      <button type="button" className="secondary-button" disabled={regenerating || !issuedCertificateCount} onClick={() => requestRegenerateIssuedCertificates()}>
                        {regenerating ? t('certificates.regenerating') : t('certificates.regenerateIssuedPdfs')}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <CountFilterRow
                className="certificate-summary-row"
                ariaLabel={t('certificates.statusFilters')}
                items={(['total', 'issued', 'pending_approval', 'rejected', 'revoked'] as const).map((key) => ({
                  key,
                  label: certificateStatusLabel(key),
                  count: certificateCounts[key] ?? 0,
                  active: certificateStatus === key || (key === 'total' && certificateStatus === 'all'),
                }))}
                onSelect={(key) => setCertificateStatus(key === 'total' ? 'all' : key)}
              />
              <div className="filters-row certificate-filters">
                <input
                  value={certificateQuery}
                  onChange={(event) => setCertificateQuery(event.target.value)}
                  placeholder={t('certificates.searchCertificatePlaceholder')}
                />
                <select value={certificateStatus} onChange={(event) => setCertificateStatus(event.target.value)}>
                  {certificateStatuses.map((status) => (
                    <option key={status} value={status}>{status === 'all' ? t('attendance.allStatuses') : certificateStatusLabel(status)}</option>
                  ))}
                </select>
              </div>
              <div className="stack-list">
                {filteredCertificates.slice(0, visibleCertificateLimit).map((certificate) => (
                  <article key={certificate.id} className="stack-list-item certificate-registry-item">
                    <div>
                      <strong>{certificate.studentName || studentFallback(certificate.studentId)}</strong>
                      <span><span className={`status-badge ${certificate.status}`}>{certificateStatusLabel(certificate.status)}</span> · {formatDate(certificate.issuedAt ?? certificate.requestedAt)}</span>
                    </div>
                    <div className="certificate-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setExpandedCertificateId((current) => current === certificate.id ? undefined : certificate.id)}
                      >
                        {expandedCertificateId === certificate.id ? t('certificates.hideActions') : t('members.actions')}
                      </button>
                      {expandedCertificateId === certificate.id ? (
                        <div className="certificate-action-group">
                          {canApproveCertificates && certificate.status === 'pending_approval' ? (
                            <>
                              <button type="button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'approve')}>{t('courses.approve')}</button>
                              <button type="button" className="secondary-button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'reject')}>{t('courses.reject')}</button>
                            </>
                          ) : null}
                          {certificate.status === 'issued' ? (
                            <>
                              {certificate.downloadUrl ? (
                                <button type="button" className="secondary-button" onClick={() => void downloadIssuedCertificate(certificate.downloadUrl, certificate.publicId)}>
                                  {t('student.download')}
                                </button>
                              ) : null}
                              {certificate.verificationUrl ? <a href={certificate.verificationUrl} target="_blank" rel="noreferrer">{t('student.verify')}</a> : null}
                              {canRegenerateCertificates ? <button type="button" className="secondary-button" disabled={regenerating} onClick={() => requestRegenerateIssuedCertificates(certificate.id)}>{t('certificates.regenerate')}</button> : null}
                              {canRevokeCertificates ? <button type="button" className="secondary-button" disabled={decisionId === certificate.id} onClick={() => openCertificateDecision(certificate, 'revoke')}>{t('certificates.revoke')}</button> : null}
                            </>
                          ) : null}
                          {certificate.status !== 'pending_approval' && certificate.status !== 'issued' ? <strong>{certificate.source ?? '-'}</strong> : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
                {!certificates.length ? (
                  <EmptyState
                    title={t('certificates.emptyCertificatesTitle')}
                    detail={t('certificates.emptyCertificatesDetail')}
                    action={canManageCertificateAdmin ? (
                      <button type="button" className="secondary-button" onClick={() => setCertificateTab('rules')}>
                        {courseSettings?.enabled ? t('certificates.courseRules') : t('certificates.enableCertificates')}
                      </button>
                    ) : null}
                  />
                ) : null}
                {certificates.length > 0 && !filteredCertificates.length ? (
                  <EmptyState
                    title={t('certificates.noMatchesTitle')}
                    detail={t('certificates.noMatchesDetail')}
                    action={<button type="button" className="secondary-button" onClick={() => { setCertificateQuery(''); setCertificateStatus('all'); }}>{t('courses.clearFilters')}</button>}
                  />
                ) : null}
                {filteredCertificates.length > visibleCertificateLimit ? (
                  <button type="button" className="secondary-button" onClick={() => setVisibleCertificateLimit((current) => current + 12)}>
                    {t('certificates.showMoreCertificates')}
                  </button>
                ) : null}
              </div>
              </section>
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
            <div className="modal-header-block">
              <span>{selectedCertificateCourse?.title ?? t('navigation.certificates')}</span>
              <h2 id="certificate-preview-modal-title">{t('certificates.certificatePreview')}</h2>
              <p>{t('certificates.previewDetail')}</p>
            </div>
            <button type="button" className="secondary-button" disabled={!courseId || !courseSettings || previewing} onClick={() => void loadExactPreview()}>
              {previewing ? t('certificates.refreshing') : t('actions.refresh')}
            </button>
          </div>
          {previewing ? (
            <div className="certificate-preview-loading large">{t('certificates.generatedPreviewLoading')}</div>
          ) : exactPreviewHtml ? (
            <iframe title={t('certificates.generatedPreviewTitle')} srcDoc={exactPreviewHtml} scrolling="no" data-preview-surface="modal" onLoad={handlePreviewFrameLoad('modal')} className={`certificate-preview-frame modal-frame ${preview.orientation === 'portrait' ? 'portrait' : ''}`} />
          ) : (
            <EmptyState title={t('certificates.previewUnavailable')} detail={exactPreviewError || t('certificates.refreshPreviewTryAgain')} />
          )}
        </Modal>
      ) : null}
      {isIssueModalOpen && canIssueCertificates ? (
        <FormModal labelledBy="issue-certificate-title" onClose={closeIssueModal} onSubmit={issueCertificate}>
            <div className="modal-header-block">
              <span>{courses.find((course) => course.id === courseId)?.title ?? t('sessions.courseRequired')}</span>
              <h2 id="issue-certificate-title">{t('certificates.issueCertificate')}</h2>
              <p>{t('certificates.issueCertificateDetail')}</p>
            </div>
            <div className="enrollment-tabs certificate-student-tabs" role="tablist" aria-label={t('certificates.studentFilters')}>
              {(['eligible', 'blocked', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={issueStudentFilter === filter ? 'active' : undefined}
                  onClick={() => setIssueStudentFilter(filter)}
                >
                  {filter === 'blocked' ? t('certificates.notEligible') : filter === 'eligible' ? t('certificates.eligible') : t('members.all')}
                </button>
              ))}
            </div>
            <label>
              {t('attendance.findStudent')}
              <input
                value={issueStudentQuery}
                onChange={(event) => setIssueStudentQuery(event.target.value)}
                placeholder={t('certificates.searchStudentPlaceholder')}
                className={issueErrors.student ? 'input-error' : ''}
                aria-invalid={!!issueErrors.student}
                autoFocus
              />
              {issueErrors.student ? <span className="field-error">{issueErrors.student}</span> : null}
            </label>
            <div className="stack-list compact certificate-student-picker" role="listbox" aria-label={t('certificates.studentsAvailableForIssue')}>
              {issueStudentOptions.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={`certificate-student-option ${selectedStudentId === student.id || selectedStudentId === student.userId ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedStudentId(student.id);
                    setPreviewStudentName(student.fullName || student.email || '');
                    setIssueErrors((current) => ({ ...current, student: '' }));
                  }}
                >
                  <span>
                    <strong>{student.fullName || student.email || studentFallback(student.id)}</strong>
                    <small>{student.email || t('certificates.studentId', { id: student.id })}</small>
                  </span>
                  <span className="certificate-student-status">
                    <span className={`status-badge ${isStudentEligibleForCertificate(student) ? 'published' : 'draft'}`}>
                      {eligibilityLabel(student)}
                    </span>
                    {student.certificateStatus ? <span className={`status-badge ${student.certificateStatus}`}>{certificateStatusLabel(student.certificateStatus)}</span> : null}
                  </span>
                </button>
              ))}
              {!issueStudentOptions.length ? (
                <EmptyState title={t('certificates.noStudentsMatchFilter')} detail={t('certificates.noStudentsMatchFilterDetail')} />
              ) : null}
            </div>
            {selectedStudent ? (
              <p className="panel-note">
                {isStudentEligibleForCertificate(selectedStudent)
                  ? t('certificates.studentMeetsRequirements')
                  : t('certificates.overrideWarning', { reason: translateEligibility(describeEligibility(selectedStudent)) })}
              </p>
            ) : null}
            {renderCertificateDisplayControls('modal-fields')}
            <label>
              {t('sessions.notes')}
              <input value={certificateNote} onChange={(event) => setCertificateNote(event.target.value)} placeholder={t('sessions.optionalInternalNote')} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeIssueModal} disabled={issuing}>{t('courses.cancel')}</button>
              <button type="submit" disabled={!courseId || !selectedStudentId || issuing}>{issuing ? t('certificates.issuing') : t('certificates.issueCertificate')}</button>
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
            <div className="modal-header-block">
              <span>{pendingDecision.action === 'approve' ? t('courses.approve') : pendingDecision.action === 'reject' ? t('courses.reject') : t('certificates.revoke')}</span>
              <h2 id="certificate-decision-title">{pendingDecision.action === 'approve' ? t('certificates.approveCertificate') : pendingDecision.action === 'reject' ? t('certificates.rejectCertificate') : t('certificates.revokeCertificate')}</h2>
              <p>
                {pendingDecision.certificate.studentName || studentFallback(pendingDecision.certificate.studentId)} · {pendingDecision.certificate.publicId}
              </p>
            </div>
            {pendingDecision.action === 'approve' ? (
              <>
                <p className="panel-note">{t('certificates.approveDetail')}</p>
                {renderCertificateDisplayControls('modal-fields')}
              </>
            ) : (
              <label>
                {t('certificates.reason')}
                <textarea
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  placeholder={t('certificates.reasonPlaceholder', { action: pendingDecision.action === 'reject' ? t('courses.reject') : t('certificates.revoke') })}
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
                {t('courses.cancel')}
              </button>
              <button
                type="button"
                className={pendingDecision.action === 'approve' ? undefined : 'danger-button'}
                onClick={() => void handleCertificateDecision()}
                disabled={decisionId === pendingDecision.certificate.id}
              >
                {decisionId === pendingDecision.certificate.id ? t('auth.working') : pendingDecision.action === 'approve' ? t('courses.approve') : pendingDecision.action === 'reject' ? t('courses.reject') : t('certificates.revoke')}
              </button>
            </div>
        </Modal>
      ) : null}
      {pendingIssueOverride ? (
        <Modal
          labelledBy="certificate-override-title"
          onClose={() => setPendingIssueOverride(null)}
        >
          <div className="modal-header-block">
            <span>{t('certificates.eligibilityOverride')}</span>
            <h2 id="certificate-override-title">{t('certificates.issueAnywayTitle')}</h2>
            <p>{t('certificates.issueAnywayDetail', { name: pendingIssueOverride.fullName || pendingIssueOverride.email || studentFallback(pendingIssueOverride.id) })}</p>
          </div>
          <p className="panel-note">{translateEligibility(describeEligibility(pendingIssueOverride))}</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingIssueOverride(null)} disabled={issuing}>{t('courses.cancel')}</button>
            <button type="button" onClick={() => void submitIssueCertificate(true)} disabled={issuing}>
              {issuing ? t('certificates.issuing') : t('certificates.issueAnyway')}
            </button>
          </div>
        </Modal>
      ) : null}
      {pendingRegenerate ? (
        <Modal
          labelledBy="certificate-regenerate-title"
          onClose={() => setPendingRegenerate(null)}
        >
          <div className="modal-header-block">
            <span>{t('certificates.pdfRegeneration')}</span>
            <h2 id="certificate-regenerate-title">{t('certificates.regeneratePdfsTitle')}</h2>
            <p>{t('certificates.regeneratePdfsDetail', { count: pendingRegenerate.count || 0 })}</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingRegenerate(null)} disabled={regenerating}>{t('courses.cancel')}</button>
            <button type="button" onClick={() => void regenerateIssuedCertificates(pendingRegenerate.certificateId)} disabled={regenerating || !pendingRegenerate.count}>
              {regenerating ? t('certificates.regenerating') : t('certificates.regeneratePdfs')}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
