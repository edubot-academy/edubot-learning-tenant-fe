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
  roles?: Array<UserRole | string>;
  membershipStatus?: string[];
  availability?: {
    enabled: boolean;
    reason?: string | null;
    status?: string | null;
  };
  permissions?: {
    canEnterWorkspace?: boolean;
    canManageTenant?: boolean;
    canManageOwners?: boolean;
    canManageMembers?: boolean;
    canManageCourses?: boolean;
    canManageCertificates?: boolean;
    canViewReports?: boolean;
    canManageBranding?: boolean;
    canManageSettings?: boolean;
    canTeachAssignedSessions?: boolean;
    canViewAssignedCourses?: boolean;
    canViewAssignedGroups?: boolean;
    canManageAssignedAttendance?: boolean;
    canManageAssignedHomework?: boolean;
    canManageAssignedActivities?: boolean;
    canManageAssignedMaterials?: boolean;
    canManageAssignedLiveMeetings?: boolean;
    canApproveAssignedCertificates?: boolean;
    canSupportOperations?: boolean;
    canViewOperationalCourses?: boolean;
    canViewOperationalGroups?: boolean;
    canViewOperationalSessions?: boolean;
    canViewStudentSupportContext?: boolean;
    canViewOperationalReports?: boolean;
    canEscalateOperationalIssues?: boolean;
    canManageStudentSupportNotes?: boolean;
    canContactStudents?: boolean;
    canViewGuardianContext?: boolean;
    canContactGuardians?: boolean;
    canCoordinateGroups?: boolean;
    canEnrollStudents?: boolean;
    canApproveCourses?: boolean;
  };
  host?: string | null;
  crmLink?: {
    linked: boolean;
    crmTenantId?: string | null;
    crmTenantSlug?: string | null;
    crmPrimaryDomain?: string | null;
    status?: string;
  } | null;
  crmTenantId?: string | null;
  crmTenantSlug?: string | null;
  crmPrimaryDomain?: string | null;
  logoUrl?: string | null;
  logoKey?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  status?: string;
  plan?: string | null;
  billingStatus?: string | null;
  featureFlags?: Record<string, boolean>;
  branding?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
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

export type TenantOverviewPermissions = {
  canEnterWorkspace?: boolean;
  canManageTenant?: boolean;
  canManageOwners?: boolean;
  canManageMembers: boolean;
  canManageCourses?: boolean;
  canViewReports?: boolean;
  canManageBranding?: boolean;
  canManageSettings?: boolean;
  canTeachAssignedSessions?: boolean;
  canViewAssignedCourses?: boolean;
  canViewAssignedGroups?: boolean;
  canManageAssignedAttendance?: boolean;
  canManageAssignedHomework?: boolean;
  canManageAssignedActivities?: boolean;
  canManageAssignedMaterials?: boolean;
  canManageAssignedLiveMeetings?: boolean;
  canApproveAssignedCertificates?: boolean;
  canSupportOperations?: boolean;
  canViewOperationalCourses?: boolean;
  canViewOperationalGroups?: boolean;
  canViewOperationalSessions?: boolean;
  canViewStudentSupportContext?: boolean;
  canViewOperationalReports?: boolean;
  canEscalateOperationalIssues?: boolean;
  canManageStudentSupportNotes?: boolean;
  canContactStudents?: boolean;
  canViewGuardianContext?: boolean;
  canContactGuardians?: boolean;
  canCoordinateGroups?: boolean;
  canEnrollStudents?: boolean;
  canApproveCourses?: boolean;
  canViewActivity: boolean;
  canManageCertificates: boolean;
  canCreateCourses: boolean;
};

export type TenantOverview = {
  generatedAt?: string;
  workspace?: {
    type: 'tenant';
    companyId: number;
    role?: string | null;
    permissions: TenantOverviewPermissions;
  };
  tenant: Pick<Tenant, 'id' | 'name' | 'timezone' | 'locale' | 'featureFlags' | 'branding'>;
  crmLink?: Tenant['crmLink'];
  role?: string | null;
  permissions: TenantOverviewPermissions;
  stats: Record<string, number | string | null>;
  courses: Course[];
  sessions: {
    upcoming: Array<Partial<CourseSession> & {
      id: number;
      title: string;
      groupName?: string | null;
      courseTitle?: string | null;
    }>;
    today: number;
    unmarkedAttendance: number;
    cancelled: number;
  };
  homework: {
    summary: Record<string, number>;
    queue: SessionHomework[];
  };
  certificates: {
    pending: number;
    issued: number;
    rejected: number;
    revoked: number;
    configuredCourses: number;
    coursesWithoutConfig: number;
    waiting?: number;
    eligibleWaiting: number;
  };
  setup: {
    progress: number;
    items: Array<{ label: string; value: string; hint: string }>;
  };
  features: Array<{ key: string; enabled: boolean; explicit: boolean }>;
  activity: TenantActivityLog[];
  analytics?: {
    context: string;
    metricScope: string;
    adminOverview: string;
    attendanceRate: string;
    dropoutRisk: string;
    groupFillRate: string;
  } | null;
};

export type InstructorDashboardSession = {
  id: number;
  title: string;
  courseId?: number | null;
  courseTitle?: string | null;
  groupId?: number | null;
  groupName?: string | null;
  instructorId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
  location?: string | null;
  liveJoinUrl?: string | null;
  liveHostUrl?: string | null;
  materialsCount?: number;
  activitiesCount?: number;
  attendanceMarked?: boolean;
  homeworkNeedsReview?: number;
};

export type InstructorDashboard = {
  generatedAt?: string;
  instructor: { id: number; fullName?: string | null; email?: string | null };
  tenant: TenantOverview['tenant'];
  role?: string | null;
  permissions: TenantOverviewPermissions;
  today: {
    sessions: InstructorDashboardSession[];
    nextSession?: InstructorDashboardSession | null;
  };
  queues: {
    unmarkedAttendance: number;
    homeworkNeedsReview: number;
    activityNeedsReview: number;
    missingHomework: number;
    upcomingWithoutMaterials: number;
  };
  attentionStudents: Array<{
    studentId: number;
    fullName?: string | null;
    groupId?: number | null;
    groupName?: string | null;
    severity?: 'high' | 'medium' | 'low' | string;
    reasons?: Array<{ code: string; label: string; route?: string }>;
  }>;
  assignedCourses: Array<{
    id: number;
    title: string;
    courseType?: string | null;
    status?: string | null;
    isPublished?: boolean;
    groupCount: number;
    activeStudentCount: number;
  }>;
  assignedGroups: Array<{
    id: number;
    name: string;
    code?: string | null;
    status?: string | null;
    courseId: number;
    courseTitle?: string | null;
    instructorId?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    timezone?: string | null;
    studentCount: number;
  }>;
  upcomingSessions: InstructorDashboardSession[];
};

export type AssistantDashboardActionType =
  | 'student_support'
  | 'pending_invitation'
  | 'missing_instructor'
  | 'missing_schedule'
  | 'missing_meeting'
  | 'unmarked_attendance'
  | 'missing_homework'
  | 'admin_escalation'
  | 'instructor_escalation'
  | string;

export type AssistantSupportStatus = 'all' | 'open' | 'in_progress' | 'resolved';

export type AssistantSupportReason = {
  code: 'low_progress' | 'missing_homework' | 'open_support_note' | string;
  count?: number;
  severity?: 'high' | 'medium' | 'low' | string;
  route?: string | null;
};

export type AssistantSupportItem = {
  studentId: number;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  groupId?: number | null;
  groupName?: string | null;
  courseId?: number | null;
  courseTitle?: string | null;
  instructorId?: number | null;
  instructorName?: string | null;
  reasons?: AssistantSupportReason[];
  lastContactAt?: string | null;
  nextAction?: string | null;
  supportStatus?: Exclude<AssistantSupportStatus, 'all'> | null;
  guardianSummary?: {
    hasGuardian: boolean;
    contactAllowed: boolean;
    preferredChannel?: string | null;
  };
};

export type AssistantSupportResponse = {
  items: AssistantSupportItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    studentsNeedingSupport: number;
    pendingInvitations: number;
    pendingEnrollments: number;
    sessionsWithoutMeeting: number;
  };
};

export type StudentSupportNote = {
  id: number;
  companyId: number;
  studentId: number;
  authorUserId?: number | null;
  category: string;
  priority: 'high' | 'medium' | 'low' | string;
  status: 'open' | 'in_progress' | 'resolved' | string;
  ownerRole: 'assistant' | 'admin' | 'instructor' | string;
  note: string;
  nextAction?: string | null;
  dueAt?: string | null;
  lastContactAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StudentGuardian = {
  id: number;
  companyId: number;
  studentId: number;
  fullName: string;
  relationship?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredChannel?: string | null;
  canReceiveProgressUpdates: boolean;
  canReceiveAttendanceUpdates: boolean;
  canReceiveHomeworkUpdates: boolean;
  consentStatus: 'pending' | 'granted' | 'revoked' | string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AssistantDashboard = {
  generatedAt?: string;
  assistant: { id: number; fullName?: string | null; email?: string | null };
  tenant: TenantOverview['tenant'];
  permissions: TenantOverviewPermissions;
  operations: {
    activeGroups: number;
    upcomingSessions: number;
    pendingEnrollments: number;
    studentsNeedingSupport: number;
    groupsWithoutInstructor: number;
    sessionsWithoutMeeting: number;
    pendingInvitations: number;
    blockedItems: number;
  };
  actionQueue: Array<{
    id: string;
    type: AssistantDashboardActionType;
    priority: 'high' | 'medium' | 'low' | string;
    title?: string;
    detail?: string | null;
    i18nKey?: string;
    params?: Record<string, number | string | null>;
    route?: string | null;
    ownerRole?: 'assistant' | 'admin' | 'instructor' | 'student' | 'guardian' | string;
    dueAt?: string | null;
  }>;
  groups: Array<{
    id: number;
    name: string;
    code?: string | null;
    status?: string | null;
    courseId: number;
    courseTitle?: string | null;
    instructorId?: number | null;
    instructorName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    timezone?: string | null;
    studentCount: number;
    nextSessionAt?: string | null;
  }>;
  studentSupportQueue: AssistantSupportItem[];
};

export type TenantReportPoint = {
  period: string;
  count?: number;
  total?: number;
  good?: number;
  rate?: number;
};

export type TenantReportSummary = {
  generatedAt?: string;
  scope?: {
    companyId?: number | null;
    from?: string | null;
    to?: string | null;
    courseId?: number | null;
    groupId?: number | null;
  };
  summary: {
    totalUsers?: number;
    totalStudents?: number;
    totalInstructors?: number;
    totalCourses?: number;
    publishedCourses?: number;
    draftCourses?: number;
    totalEnrollments?: number;
    totalRevenue?: number;
    revenue?: {
      amount?: number;
      scope?: 'all_courses' | 'owned_courses_only';
      isPartial?: boolean;
    };
    attendanceRate?: number;
    groupFillRate?: number;
    dropoutRisk?: { high?: number; medium?: number; low?: number };
    certificates?: {
      pending?: number;
      issued?: number;
      rejected?: number;
      revoked?: number;
      total?: number;
    };
  };
  charts?: {
    topCourses?: Array<{ courseId: number; title: string; enrollments: number }>;
    lowPerformingCourses?: Array<{ courseId: number; title: string; completionRate: number; avgProgress: number }>;
  };
};

export type TenantReportTimeSeries = {
  generatedAt?: string;
  series: {
    enrollments: TenantReportPoint[];
    attendance: TenantReportPoint[];
    completions: TenantReportPoint[];
    certificates: TenantReportPoint[];
  };
};

export type WorkspaceItem = {
  id: string;
  type: 'main' | 'tenant';
  companyId: number | null;
  name: string;
  role?: UserRole | string | null;
  roles?: Array<UserRole | string>;
  membershipStatus?: string[];
  status?: string | null;
  plan?: string | null;
  billingStatus?: string | null;
  featureFlags?: Record<string, boolean> | null;
  timezone?: string | null;
  locale?: string | null;
  availability?: Tenant['availability'];
  permissions?: Tenant['permissions'];
  branding?: Record<string, unknown> | null;
  logoUrl?: string | null;
  host?: string | null;
  crmLink?: Tenant['crmLink'];
};

export type WorkspaceListResponse = {
  active: WorkspaceItem | null;
  items: WorkspaceItem[];
};

export type Course = {
  id: number;
  title: string;
  description?: string | null;
  courseType?: 'video' | 'offline' | 'online_live';
  status?: string;
  isPublished?: boolean;
  enrolledStudents?: number;
  groupCount?: number;
  sessionCount?: number;
  certificateConfigured?: boolean;
  health?: {
    approvalStatus?: string;
    isPublished?: boolean;
    instructorAssigned?: boolean;
    groupCount?: number;
    sessionCount?: number;
    certificateConfigured?: boolean;
    enrolledStudents?: number;
  };
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
  certificateEligible?: boolean;
  certificateEligibility?: {
    eligible: boolean;
    progressPercent: number;
    completed: boolean;
    reasons?: string[];
    attendance?: {
      required: boolean;
      passed: boolean;
      percent: number;
      requiredPercent: number;
      attendedSessions: number;
      completedSessions: number;
      requiredSessions: number;
    };
    homework?: {
      required: boolean;
      passed: boolean;
      percent: number;
      requiredPercent: number;
      approved: number;
      requiredItems: number;
    };
    activities?: {
      required: boolean;
      passed: boolean;
      percent: number;
      requiredPercent: number;
      completed: number;
      requiredItems: number;
    };
  } | null;
  certificateId?: number | null;
  certificatePublicId?: string | null;
  certificateStatus?: string | null;
  certificateIssuedAt?: string | null;
  hasCertificate?: boolean;
  certificateDownloadUrl?: string | null;
  certificateVerificationUrl?: string | null;
  lastViewedLessonId?: number | null;
  lastVideoTime?: number | null;
};

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type AttendanceRecord = {
  id?: number;
  sessionId?: number;
  userId: number;
  courseId?: number;
  sessionDate?: string | null;
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
  assignedStudentIds?: number[] | null;
  courseId?: number | null;
  groupId?: number | null;
  sessionTitle?: string | null;
  courseTitle?: string | null;
  groupName?: string | null;
  queue?: {
    assigned?: number;
    assignedCount?: number;
    submitted?: number;
    submittedCount?: number;
    approved?: number;
    approvedCount?: number;
    rejected?: number;
    rejectedCount?: number;
    needsRevision?: number;
    needsRevisionCount?: number;
    missing?: number;
    missingCount?: number;
    needsReview?: number;
    needsReviewCount?: number;
    late?: number;
    pendingSubmissionCount?: number;
    lateCount?: number;
  };
};

export type HomeworkReviewQueue = {
  items: SessionHomework[];
  summary: {
    total: number;
    needsReview: number;
    missing: number;
    needsRevision: number;
    late: number;
    actionRequired: number;
  };
};

export type ActivityReviewQueue = {
  items: Array<{
    submissionId: number;
    activityId: number;
    activityTitle?: string | null;
    activityType?: string | null;
    sessionId?: number | null;
    sessionTitle?: string | null;
    courseId?: number | null;
    courseTitle?: string | null;
    groupId?: number | null;
    groupName?: string | null;
    studentId: number;
    studentName?: string | null;
    status?: string | null;
    score?: number | null;
    answerText?: string | null;
    attachmentUrl?: string | null;
    submittedAt?: string | null;
    updatedAt?: string | null;
  }>;
  summary: {
    total: number;
    needsReview: number;
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
  invitation?: {
    status?: string | null;
    setupLink?: string | null;
    expiresAt?: string | null;
    emailSent?: boolean | null;
    sentAt?: string | null;
  } | null;
  onboarding?: {
    status?: string | null;
    setupRequired?: boolean | null;
    setupCompleted?: boolean | null;
    setupCompletedAt?: string | null;
    setupLink?: string | null;
    expiresAt?: string | null;
    emailSent?: boolean | null;
  } | null;
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
  secondaryBrandLogoUrl?: string | null;
  certificateTitle?: string | null;
  certificateLanguage?: 'en' | 'ru' | 'ky' | null;
  pageOrientation?: 'landscape' | 'portrait' | null;
  signatureAssetKey?: string | null;
  signatureAssetUrl?: string | null;
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

export type StudentSubmission = {
  id?: number;
  answerText?: string | null;
  attachmentUrl?: string | null;
  attachmentKey?: string | null;
  status?: string | null;
  score?: number | null;
  reviewComment?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type StudentTaskSubmissionRequirements = {
  allowText?: boolean;
  allowFile?: boolean;
  allowLink?: boolean;
  maxFileSize?: number | null;
  allowedFileTypes?: string[] | null;
};

export type StudentCourseSummary = {
  id?: number;
  courseId?: number;
  title?: string;
  courseTitle?: string;
  progress?: number;
  progressPercent?: number;
  attendanceRate?: number | null;
  status?: string;
  groupName?: string;
};

export type StudentSessionSummary = {
  id?: number;
  sessionId?: number;
  courseId?: number | null;
  groupId?: number | null;
  title?: string;
  sessionTitle?: string;
  courseTitle?: string;
  groupName?: string | null;
  startsAt?: string;
  liveJoinUrl?: string | null;
  url?: string | null;
  materials?: Array<{ title?: string; url?: string | null; type?: string }>;
};

export type StudentMaterialItem = {
  id?: string | number;
  title?: string;
  type?: string;
  url?: string | null;
  sessionId?: number;
  sessionTitle?: string;
  courseId?: number | null;
  courseTitle?: string | null;
  groupId?: number | null;
  groupName?: string | null;
  createdAt?: string;
};

export type StudentHomeworkItem = StudentTaskSubmissionRequirements & {
  id?: number;
  sessionId?: number;
  kind?: string;
  title?: string;
  description?: string | null;
  courseTitle?: string;
  sessionTitle?: string;
  deadline?: string | null;
  dueAt?: string | null;
  status?: string;
  reviewState?: string;
  mySubmission?: StudentSubmission | null;
  submissions?: StudentSubmission[];
  submissionHistory?: StudentSubmission[];
  submissionRequirements?: StudentTaskSubmissionRequirements | null;
};

export type StudentTaskItem = StudentTaskSubmissionRequirements & {
  id?: number;
  sessionId?: number;
  courseId?: number | null;
  groupId?: number | null;
  kind?: string;
  taskType?: string;
  activityType?: string;
  title?: string;
  description?: string | null;
  type?: string;
  status?: string;
  dueAt?: string | null;
  courseTitle?: string;
  sessionTitle?: string | null;
  mySubmission?: StudentSubmission | null;
  submission?: StudentSubmission | null;
  submissions?: StudentSubmission[];
  submissionHistory?: StudentSubmission[];
  submissionRequirements?: StudentTaskSubmissionRequirements | null;
  myAttempt?: { score?: number; passed?: boolean; createdAt?: string } | null;
  attempt?: { score?: number; passed?: boolean; createdAt?: string } | null;
  questions?: Array<{
    id: number;
    prompt: string;
    questionMode?: 'single_choice' | 'multiple_choice';
    options: Array<{ id: number; text: string }>;
  }>;
};

export type StudentCertificateSummary = {
  id?: number;
  publicId?: string;
  courseId?: number;
  courseTitle?: string;
  groupId?: number | null;
  groupName?: string | null;
  status?: string;
  issuedAt?: string | null;
  downloadUrl?: string | null;
  verificationUrl?: string | null;
};

export type StudentCourseDetail = {
  course?: StudentCourseSummary & { courseId?: number; coverImageUrl?: string | null; instructor?: { name?: string | null } | null };
  progress?: { progressPercent?: number; status?: string; completedAt?: string | null } | null;
  sessions?: StudentSessionSummary[];
  materials?: Array<StudentSessionSummary | StudentMaterialItem>;
  recordings?: Array<StudentSessionSummary | StudentMaterialItem>;
  tasks?: StudentTaskItem[];
  certificate?: unknown;
};

export type StudentSessionDetail = StudentSessionSummary & {
  recordingUrl?: string | null;
  materials?: Array<{ index?: number; title?: string; url?: string | null; storageKey?: string | null; type?: string }>;
  attendance?: AttendanceRecord | null;
  homework?: StudentHomeworkItem[];
  tasks?: StudentTaskItem[];
};

export type StudentProgressSummary = {
  courses?: Array<StudentCourseSummary & { courseTitle?: string; attendanceRate?: number | null; certificate?: unknown }>;
  attendance?: { total?: number; presentOrLate?: number; rate?: number | null; recent?: AttendanceRecord[] };
  gradedTasks?: StudentTaskItem[];
  certificates?: StudentCertificateSummary[];
  recentFeedback?: StudentTaskItem[];
};

export type StudentSupportOptions = {
  categories?: Array<string | { id?: string; value?: string; label?: string }>;
  priorities?: Array<string | { id?: string; value?: 'high' | 'medium' | 'low'; label?: string }>;
  supportEmail?: string | null;
  contactPolicy?: Record<string, unknown> | null;
};

export type StudentSupportRequest = {
  id?: number;
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: string;
  message?: string;
  createdAt?: string;
};

export type StudentAccessState = {
  hasActiveAccess?: boolean;
  activeEnrollmentCount?: number;
  pendingEnrollmentCount?: number;
  latestEnrollment?: {
    enrollmentId?: number;
    courseId?: number | null;
    courseName?: string | null;
    groupId?: number | null;
    groupName?: string | null;
    enrollmentStatus?: string | null;
    accessStatus?: string | null;
    enrolledAt?: string | null;
  } | null;
  message?: string | null;
};

export type StudentNotification = {
  id?: number;
  title?: string;
  body?: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
};

export type StudentNotificationPage = {
  items?: StudentNotification[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export type StudentReminder = {
  id?: string;
  kind?: 'session' | 'task';
  title?: string;
  message?: string;
  dueAt?: string | null;
  status?: string;
  priority?: 'low' | 'medium' | 'high';
  courseTitle?: string | null;
  groupName?: string | null;
  actionUrl?: string | null;
};
