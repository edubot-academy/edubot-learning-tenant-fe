export type UserRole = 'superadmin' | 'admin' | 'owner' | 'company_admin' | 'assistant' | 'instructor' | 'student';

export type AuthUser = {
  id: number;
  email: string;
  fullName?: string;
  role: UserRole | string;
};

export type UserSummary = {
  id: number;
  email: string;
  fullName?: string;
  role?: UserRole | string;
};

export type Tenant = {
  id: number;
  name: string;
  role?: UserRole | string | null;
  logoUrl?: string | null;
  logoKey?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  status?: string;
  plan?: string | null;
  billingStatus?: string | null;
  featureFlags?: Record<string, boolean>;
  branding?: Record<string, unknown> | null;
  timezone?: string | null;
  locale?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  telegram?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  taxId?: string | null;
  notes?: string | null;
};

export type TenantActivityLog = {
  id: number;
  companyId: number;
  actorUserId?: number | null;
  actorFullName?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type Course = {
  id: number;
  title: string;
  courseType?: 'video' | 'offline' | 'online_live';
  status?: string;
  isPublished?: boolean;
  enrolledStudents?: number;
  coverImageUrl?: string | null;
  instructor?: { id: number; fullName?: string };
};

export type CourseGroup = {
  id: number;
  name: string;
  code?: string;
  courseId: number;
  companyId?: number | null;
  status?: string;
  instructorId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  seatLimit?: number | null;
  timezone?: string | null;
  location?: string | null;
  meetingProvider?: string | null;
  meetingUrl?: string | null;
  scheduleNote?: string | null;
  scheduleBlocks?: Array<{
    day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | string;
    startTime: string;
    endTime: string;
  }> | null;
};

export type SessionGenerationPreview = {
  group: {
    id: number;
    name: string;
    courseId: number;
  };
  fromDate: string;
  toDate: string;
  total: number;
  newCount: number;
  existingCount: number;
  items: Array<{
    kind: 'new' | 'existing';
    sessionId?: number | null;
    sessionIndex: number;
    title: string;
    startsAt: string;
    endsAt: string;
    day: string;
  }>;
};

export type SessionGenerationResult = {
  createdCount: number;
  skippedCount: number;
  items: Array<{
    id: number;
    sessionIndex: number;
    title: string;
    startsAt: string;
    endsAt: string;
  }>;
};

export type CourseSession = {
  id: number;
  title: string;
  courseId: number;
  groupId?: number | null;
  sessionIndex?: number;
  startsAt?: string;
  endsAt?: string;
  status?: string;
  notes?: string | null;
  recordingUrl?: string | null;
  liveProvider?: 'zoom' | 'google_meet' | 'custom' | string | null;
  liveJoinUrl?: string | null;
  liveHostUrl?: string | null;
  externalMeetingId?: string | null;
  materials?: SessionMaterial[];
  activities?: SessionActivity[];
};

export type SessionMaterial = {
  title: string;
  url: string;
  storageKey?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  size?: number | null;
};

export type LiveMeeting = {
  success?: boolean;
  provider?: 'zoom' | 'google_meet' | 'custom' | string | null;
  sessionId?: number;
  meetingId?: string | null;
  joinUrl?: string | null;
  hostUrl?: string | null;
  deleted?: boolean;
};

export type SessionActivityType = 'discussion' | 'exercise' | 'quiz' | 'group_work';
export type SessionActivityStatus = 'planned' | 'active' | 'done';

export type SessionActivity = {
  id: number;
  title: string;
  description?: string | null;
  type: SessionActivityType;
  status: SessionActivityStatus;
  questions?: Array<{
    id?: number;
    prompt: string;
    questionMode?: 'single_choice' | 'multiple_choice';
    options: Array<{
      id?: number;
      text: string;
      isCorrect?: boolean;
    }>;
  }>;
};

export type SessionActivityResponseSet = {
  activity: SessionActivity;
  mode: 'quiz' | 'submission';
  items: Array<{
    id?: number;
    studentId: number;
    studentName?: string | null;
    status?: string;
    answerText?: string | null;
    attachmentUrl?: string | null;
    score?: number | null;
    reviewComment?: string | null;
    reviewedAt?: string | null;
    updatedAt?: string | null;
    latestAttemptId?: number;
    attemptsCount?: number;
    passed?: boolean;
    answeredCount?: number;
    submittedAt?: string | null;
  }>;
};

export type SessionInsights = {
  summary?: {
    rosterTotal?: number;
    attendanceMarked?: number;
    followUpStudents?: number;
    positiveStudents?: number;
    teacherQueue?: number;
  };
  teacherQueue?: {
    attendanceUnmarked?: number;
    homeworkNeedsReview?: number;
    activityNeedsReview?: number;
  };
  attendance?: Record<string, number>;
  homework?: Record<string, number>;
  activities?: Record<string, number>;
  attentionStudents?: Array<{
    studentId: number;
    fullName: string;
    severity?: 'high' | 'medium' | 'low';
    reasons?: Array<{ code?: string; label: string; tone?: string; tab?: string }>;
  }>;
  positiveStudents?: Array<{
    studentId: number;
    fullName: string;
    streak?: number;
    signals?: string[];
  }>;
};

export type GroupStudent = {
  id: number;
  userId: number;
  fullName?: string;
  email?: string;
  phoneNumber?: string | null;
  courseId?: number;
  groupId?: number;
  courseGroupId?: number;
  enrolledAt?: string;
  progressPercent?: number;
  completed?: boolean;
  lastViewedLessonId?: number | null;
  lastVideoTime?: number | null;
};

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type AttendanceRecord = {
  id?: number;
  sessionId?: number;
  userId: number;
  courseId?: number;
  status: AttendanceStatus;
  joinedAt?: string | null;
  leftAt?: string | null;
  notes?: string | null;
};

export type SessionHomework = {
  id: number;
  sessionId: number;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  deadline?: string | null;
  maxScore?: number | null;
  isPublished?: boolean;
  courseId?: number | null;
  groupId?: number | null;
  sessionTitle?: string | null;
  courseTitle?: string | null;
  groupName?: string | null;
  queue?: {
    assigned?: number;
    submitted?: number;
    approved?: number;
    rejected?: number;
    needsRevision?: number;
    missing?: number;
    needsReview?: number;
  };
};

export type HomeworkSubmission = {
  id: number;
  homeworkId: number;
  studentId: number;
  answerText?: string | null;
  attachmentUrl?: string | null;
  status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_revision' | string;
  score?: number | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  student?: {
    id: number;
    fullName?: string | null;
    email?: string | null;
  };
};

export type HomeworkReviewRoster = {
  summary: {
    total: number;
    pendingSubmission: number;
    missing: number;
    needsReview: number;
    approved: number;
    rejected: number;
    needsRevision: number;
    late: number;
  };
  items: Array<{
    studentId: number;
    fullName?: string | null;
    email?: string | null;
    reviewState: 'pending_submission' | 'missing' | 'needs_review' | 'approved' | 'rejected' | 'needs_revision' | string;
    hasSubmission: boolean;
    isLate: boolean;
    deadline?: string | null;
    submission?: HomeworkSubmission | null;
    status?: string | null;
  }>;
};

export type CompanyMember = {
  userId: number;
  role: UserRole | string;
  fullName?: string;
  email?: string;
  createdAt?: string;
  user?: {
    id: number;
    fullName?: string;
    email?: string;
  };
};

export type CertificateBranding = {
  companyId: number;
  primaryBrandName?: string | null;
  primaryBrandLogoUrl?: string | null;
  primaryBrandLogoKey?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  certificateTitle?: string | null;
  certificateLanguage?: string | null;
  pageOrientation?: 'landscape' | 'portrait' | null;
  issuerDisplayName?: string | null;
  issuerTitle?: string | null;
};

export type CourseCertificateSettings = {
  courseId: number;
  enabled?: boolean;
  issueMode?: 'manual' | 'auto';
  approvalMode?: 'none' | 'instructor' | 'admin';
  allowReissue?: boolean;
  primaryColor?: string | null;
  accentColor?: string | null;
  secondaryBrandName?: string | null;
  secondaryBrandLogoKey?: string | null;
  certificateTitle?: string | null;
  certificateLanguage?: 'en' | 'ru' | 'ky' | null;
  pageOrientation?: 'landscape' | 'portrait' | null;
  eligibilityAttendanceRequired?: boolean;
  eligibilityAttendancePercent?: number;
  eligibilityHomeworkRequired?: boolean;
  eligibilityHomeworkPercent?: number;
  eligibilityActivitiesRequired?: boolean;
  eligibilityActivitiesPercent?: number;
};

export type CourseCertificate = {
  id: number;
  publicId: string;
  studentId: number;
  studentName?: string | null;
  courseId: number;
  status: string;
  source?: string;
  issuedAt?: string | null;
  approvedAt?: string | null;
  requestedAt?: string | null;
  downloadUrl?: string | null;
  verificationUrl?: string | null;
};
