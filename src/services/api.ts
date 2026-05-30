import type {
  AttendanceRecord,
  AttendanceStatus,
  ActivityReviewQueue,
  AiCourseDraftResponse,
  AiFeedbackDraftResponse,
  AiHomeworkDraftResponse,
  AiLmsCapabilities,
  AiMessageDraftResponse,
  AiQuizDraftResponse,
  AiWorksheetDraftResponse,
  AssistantDashboard,
  AssistantSupportResponse,
  AssistantSupportStatus,
  CertificateBranding,
  CourseCertificate,
  CourseCertificateSettings,
  CompanyMember,
  Course,
  CourseDeliveryContext,
  CourseGroup,
  CourseSession,
  GroupStudent,
  HomeworkReviewQueue,
  HomeworkReviewRoster,
  HomeworkSubmission,
  InstructorDashboard,
  LiveMeeting,
  SessionMaterial,
  SessionActivity,
  SessionActivityResponseSet,
  SessionActivityStatus,
  SessionActivityType,
  SessionGenerationPreview,
  SessionGenerationResult,
  SessionInsights,
  SessionHomework,
  StudentGuardian,
  StudentCertificateSummary,
  StudentCourseDetail,
  StudentCourseSummary,
  StudentHomeworkItem,
  StudentMaterialItem,
  StudentNotificationPage,
  StudentProgressSummary,
  StudentReminder,
  StudentSessionDetail,
  StudentSessionSummary,
  StudentSupportOptions,
  StudentSupportRequest,
  StudentSupportNote,
  StudentTaskItem,
  Tenant,
  TenantActivityLog,
  TenantOverview,
  TenantReportSummary,
  TenantReportTimeSeries,
  TenantMemberResolveResult,
} from '../types/domain';
import { API_BASE_URL, api, dedupeRead, toStudentPage, type StudentPagedResponse } from './http';

export { API_BASE_URL, AUTH_EXPIRED_EVENT, api, tenantStore, tokenStore, type StudentPagedResponse } from './http';
export {
  completeAccountSetup,
  getCurrentUser,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
} from './authApi';
export {
  listMyTenants,
  listTenantWorkspaces,
  resolveTenantByHost,
  switchTenantWorkspace,
} from './tenantApi';
export {
  getStudentAccess,
  getStudentNotificationUnreadCount,
  listStudentNotifications,
  markStudentNotificationRead,
} from './shellApi';

export async function getTenant(tenantId: number) {
  const { data } = await api.get<Tenant>(`/companies/${tenantId}`);
  return data;
}

export async function updateTenant(tenantId: number, patch: Partial<Pick<Tenant,
  'name' | 'logoUrl' | 'timezone' | 'locale' | 'website' | 'email' | 'phone' |
  'contactName' | 'contactEmail' | 'contactPhone' | 'address' | 'city' | 'country' |
  'telegram' | 'whatsapp' | 'instagram' | 'taxId' | 'notes'
>>) {
  const { data } = await api.patch<Tenant>(`/companies/${tenantId}`, patch);
  return data;
}

export async function updateTenantBranding(tenantId: number, patch: {
  displayName?: string | null;
  certificateLogoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
}) {
  const { data } = await api.patch<Tenant>(`/companies/${tenantId}/branding`, patch);
  return data;
}

export async function updateTenantSettings(tenantId: number, patch: {
  supportEmail?: string | null;
  defaultCourseVisibility?: 'PUBLIC' | 'PRIVATE' | 'TENANT_ONLY' | null;
  allowSelfEnrollment?: boolean | null;
  requireEnrollmentApproval?: boolean | null;
}) {
  const { data } = await api.patch<Tenant>(`/companies/${tenantId}/settings`, patch);
  return data;
}

export async function uploadTenantLogo(tenantId: number, file: File) {
  const formData = new FormData();
  formData.append('logo', file);
  const { data } = await api.post<Tenant>(`/companies/${tenantId}/upload-logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function listTenantActivity(tenantId: number, params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<{ items?: TenantActivityLog[] } | TenantActivityLog[]>(`/companies/${tenantId}/activity`, {
    params: { page: params.page ?? 1, limit: params.limit ?? 10 },
  });
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function getTenantOverview(tenantId: number) {
  const { data } = await api.get<TenantOverview>(`/companies/${tenantId}/overview`);
  return data;
}

export async function getTenantDashboard(tenantId: number) {
  const { data } = await api.get<TenantOverview>(`/companies/${tenantId}/dashboard`);
  return data;
}

export async function getInstructorDashboard(tenantId: number) {
  const { data } = await api.get<InstructorDashboard>(`/companies/${tenantId}/instructor-dashboard`);
  return data;
}

export async function getAssistantDashboard(tenantId: number) {
  const { data } = await api.get<AssistantDashboard>(`/companies/${tenantId}/assistant-dashboard`);
  return data;
}

export async function getAssistantSupport(tenantId: number, params: {
  page?: number;
  limit?: number;
  q?: string;
  status?: AssistantSupportStatus;
} = {}) {
  const { data } = await api.get<AssistantSupportResponse>(`/companies/${tenantId}/student-support`, { params });
  return data;
}

export async function listStudentSupportNotes(tenantId: number, studentId: number) {
  const { data } = await api.get<StudentSupportNote[]>(`/companies/${tenantId}/student-support/${studentId}/notes`);
  return data;
}

export async function createStudentSupportNote(tenantId: number, payload: {
  studentId: number;
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  ownerRole?: 'assistant' | 'admin' | 'instructor';
  note: string;
  nextAction?: string | null;
  dueAt?: string | null;
  lastContactAt?: string | null;
}) {
  const { data } = await api.post<StudentSupportNote>(`/companies/${tenantId}/student-support/notes`, payload);
  return data;
}

export async function updateStudentSupportNote(tenantId: number, noteId: number, payload: Partial<{
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'high' | 'medium' | 'low';
  ownerRole: 'assistant' | 'admin' | 'instructor';
  note: string;
  nextAction: string | null;
  dueAt: string | null;
  lastContactAt: string | null;
}>) {
  const { data } = await api.patch<StudentSupportNote>(`/companies/${tenantId}/student-support/notes/${noteId}`, payload);
  return data;
}

export async function listStudentGuardians(tenantId: number, studentId: number) {
  const { data } = await api.get<StudentGuardian[]>(`/companies/${tenantId}/students/${studentId}/guardians`);
  return data;
}

export async function createStudentGuardian(tenantId: number, payload: {
  studentId: number;
  fullName: string;
  relationship?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredChannel?: string | null;
  notes?: string | null;
}) {
  const { data } = await api.post<StudentGuardian>(`/companies/${tenantId}/students/guardians`, payload);
  return data;
}

export async function getTenantReportSummary(tenantId: number) {
  const { data } = await api.get<TenantReportSummary>(`/companies/${tenantId}/reports/summary`);
  return data;
}

export async function getTenantReportTimeSeries(tenantId: number) {
  const { data } = await api.get<TenantReportTimeSeries>(`/companies/${tenantId}/reports/time-series`);
  return data;
}

export async function listTenantCourses(tenantId: number) {
  return dedupeRead(`tenant:${tenantId}:courses`, async () => {
    const { data } = await api.get<{ items?: Course[] } | Course[]>(`/companies/${tenantId}/courses`, {
      params: { limit: 100 },
    });
    return Array.isArray(data) ? data : data.items ?? [];
  });
}

export async function listCourseStudents(courseId: number, params: {
  page?: number;
  limit?: number;
  q?: string;
  progressGte?: number;
  progressLte?: number;
} = {}) {
  const { data } = await api.get<{
    students?: GroupStudent[];
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  }>(`/courses/${courseId}/students`, {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      q: params.q || undefined,
      progressGte: params.progressGte,
      progressLte: params.progressLte,
    },
  });
  return {
    students: data.students ?? [],
    page: data.page ?? params.page ?? 1,
    limit: data.limit ?? params.limit ?? 50,
    total: data.total ?? data.students?.length ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

export async function createTenantCourse(tenantId: number, payload: {
  title: string;
  description: string;
  courseType: 'offline' | 'online_live' | 'video';
  instructorId?: number | null;
}) {
  const { data } = await api.post<Course>('/courses', {
    title: payload.title,
    description: payload.description,
    price: 0,
    isPaid: false,
    visibility: 'PRIVATE',
    companyId: tenantId,
    courseType: payload.courseType,
    instructorId: payload.instructorId,
  });
  return data;
}

export async function updateTenantCourse(courseId: number, payload: {
  title?: string;
  description?: string;
  courseType?: 'offline' | 'online_live' | 'video';
  instructorId?: number | null;
}) {
  const { data } = await api.patch<Course>(`/courses/${courseId}`, {
    ...payload,
    visibility: 'PRIVATE',
  });
  return data;
}

export async function publishTenantCourse(courseId: number) {
  const { data } = await api.patch<Course>(`/courses/${courseId}/publish`);
  return data;
}

export async function deleteTenantCourse(courseId: number) {
  const { data } = await api.delete<{ message?: string }>(`/courses/${courseId}`);
  return data;
}

export async function updateCourseStatus(courseId: number, status: 'pending' | 'approved' | 'rejected') {
  const { data } = await api.patch<{ success: boolean; status: string }>(`/courses/${courseId}/status`, { status });
  return data;
}

export async function getCourseDeliveryContext(courseId: number) {
  const { data } = await api.get<CourseDeliveryContext>(`/courses/${courseId}/delivery-context`);
  return data;
}

export async function listCourseGroups(courseId?: number) {
  return dedupeRead(`course-groups:${courseId ?? 'all'}`, async () => {
    const { data } = await api.get<{ items?: CourseGroup[] } | CourseGroup[]>('/course-groups', {
      params: courseId ? { courseId } : undefined,
    });
    return Array.isArray(data) ? data : data.items ?? [];
  });
}

export async function createCourseGroup(payload: {
  courseId: number;
  name: string;
  code: string;
  deliveryMode?: 'group' | 'individual';
  status?: 'planned' | 'open' | 'active' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
  seatLimit?: number;
  timezone?: string;
  location?: string;
  meetingProvider?: string;
  meetingUrl?: string;
  scheduleNote?: string;
  scheduleBlocks?: Array<{ day: string; startTime: string; endTime: string }> | null;
  instructorId?: number;
}) {
  const { data } = await api.post<CourseGroup>('/course-groups', payload);
  return data;
}

export async function createIndividualCourseGroup(payload: {
  courseId: number;
  studentId: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  location?: string;
  meetingProvider?: string;
  meetingUrl?: string;
  scheduleBlocks?: Array<{ day: string; startTime: string; endTime: string }> | null;
  instructorId?: number;
  createFirstSession?: boolean;
}) {
  const { data } = await api.post<{ group: CourseGroup; enrollment?: unknown; firstSession?: CourseSession | null }>('/course-groups/individual', payload);
  return data;
}

export async function updateCourseGroup(groupId: number, payload: {
  name?: string;
  code?: string;
  deliveryMode?: 'group' | 'individual';
  status?: 'planned' | 'open' | 'active' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
  seatLimit?: number;
  timezone?: string;
  location?: string;
  meetingProvider?: string;
  meetingUrl?: string;
  scheduleNote?: string | null;
  scheduleBlocks?: Array<{ day: string; startTime: string; endTime: string }> | null;
  instructorId?: number | null;
}) {
  const { data } = await api.patch<CourseGroup>(`/course-groups/${groupId}`, payload);
  return data;
}

export async function previewGeneratedSessions(groupId: number, params: { fromDate?: string; toDate?: string }) {
  const { data } = await api.get<SessionGenerationPreview>(`/course-groups/${groupId}/session-generation/preview`, {
    params,
  });
  return data;
}

export async function generateGroupSessions(groupId: number, payload: { fromDate?: string; toDate?: string }) {
  const { data } = await api.post<SessionGenerationResult>(`/course-groups/${groupId}/session-generation`, payload);
  return data;
}

function normalizeDateString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : undefined;
}

function normalizeCourseSession(value: CourseSession): CourseSession {
  const raw = value as CourseSession & {
    id?: unknown;
    courseId?: unknown;
    groupId?: unknown;
    sessionIndex?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    materials?: unknown;
    activities?: unknown;
  };
  return {
    ...value,
    id: normalizeOptionalNumber(raw.id) ?? value.id,
    courseId: normalizeOptionalNumber(raw.courseId) ?? value.courseId,
    groupId: raw.groupId === null ? null : normalizeOptionalNumber(raw.groupId),
    sessionIndex: normalizeOptionalNumber(raw.sessionIndex),
    startsAt: normalizeDateString(raw.startsAt),
    endsAt: normalizeDateString(raw.endsAt),
    materials: Array.isArray(raw.materials) ? raw.materials as CourseSession['materials'] : [],
    activities: Array.isArray(raw.activities) ? raw.activities as CourseSession['activities'] : [],
  };
}

export async function listGroupSessions(groupId?: number) {
  return dedupeRead(`group-sessions:${groupId ?? 'all'}`, async () => {
    const { data } = await api.get<{ items?: CourseSession[] } | CourseSession[]>('/group-sessions', {
      params: groupId ? { groupId } : undefined,
    });
    const items = Array.isArray(data) ? data : data.items ?? [];
    return items.map(normalizeCourseSession);
  });
}

const pendingGroupSessionCreates = new Map<string, Promise<CourseSession>>();

export async function createGroupSession(payload: {
  groupId: number;
  sessionIndex: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}) {
  const requestKey = JSON.stringify({
    groupId: payload.groupId,
    sessionIndex: payload.sessionIndex,
    title: payload.title,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    status: payload.status ?? 'scheduled',
    notes: payload.notes ?? '',
  });
  const pending = pendingGroupSessionCreates.get(requestKey);
  if (pending) return pending;

  const request = api.post<CourseSession>('/group-sessions', payload)
    .then(({ data }) => normalizeCourseSession(data))
    .finally(() => {
      pendingGroupSessionCreates.delete(requestKey);
    });
  pendingGroupSessionCreates.set(requestKey, request);
  return request;
}

export async function updateGroupSession(sessionId: number, payload: {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  recordingUrl?: string;
  materials?: SessionMaterial[];
}) {
  const { data } = await api.patch<CourseSession>(`/group-sessions/${sessionId}`, payload);
  return data;
}

export async function uploadSessionMaterial(sessionId: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<SessionMaterial>(
    `/group-sessions/${sessionId}/materials/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function getLiveMeeting(sessionId: number, provider?: 'zoom' | 'google_meet' | 'custom') {
  return dedupeRead(`live-meeting:${sessionId}:${provider ?? 'default'}`, async () => {
    const { data } = await api.get<LiveMeeting>(`/live-integration/sessions/${sessionId}/meeting`, {
      params: provider ? { provider } : undefined,
    });
    return data;
  });
}

export async function createLiveMeeting(sessionId: number, payload: {
  provider?: 'zoom' | 'google_meet' | 'custom';
  customJoinUrl?: string;
  topic?: string;
  agenda?: string;
  startTime?: string;
  durationMinutes?: number;
  timezone?: string;
  hostUserId?: string;
}) {
  const { data } = await api.post<LiveMeeting>(`/live-integration/sessions/${sessionId}/meeting`, payload);
  return data;
}

export async function updateLiveMeeting(sessionId: number, payload: {
  provider?: 'zoom' | 'google_meet' | 'custom';
  customJoinUrl?: string;
  topic?: string;
  agenda?: string;
  startTime?: string;
  durationMinutes?: number;
  timezone?: string;
  hostUserId?: string;
}) {
  const { data } = await api.patch<LiveMeeting>(`/live-integration/sessions/${sessionId}/meeting`, payload);
  return data;
}

export async function deleteLiveMeeting(sessionId: number, provider?: 'zoom' | 'google_meet' | 'custom') {
  const { data } = await api.delete<LiveMeeting>(`/live-integration/sessions/${sessionId}/meeting`, {
    params: provider ? { provider } : undefined,
  });
  return data;
}

export type SessionActivityPayload = {
  title: string;
  description?: string | null;
  type: SessionActivityType;
  status: SessionActivityStatus;
  questions?: Array<{
    prompt: string;
    questionMode?: 'single_choice' | 'multiple_choice';
    options: Array<{ text: string; isCorrect?: boolean }>;
  }>;
};

export async function listSessionActivities(sessionId: number) {
  const { data } = await api.get<SessionActivity[]>(`/group-sessions/${sessionId}/activities`);
  return data;
}

export async function createSessionActivity(sessionId: number, payload: SessionActivityPayload) {
  const { data } = await api.post<SessionActivity[]>(`/group-sessions/${sessionId}/activities`, payload);
  return data;
}

export async function updateSessionActivity(sessionId: number, activityId: number, payload: SessionActivityPayload) {
  const { data } = await api.patch<SessionActivity[]>(`/group-sessions/${sessionId}/activities/${activityId}`, payload);
  return data;
}

export async function deleteSessionActivity(sessionId: number, activityId: number) {
  const { data } = await api.post<{ ok: boolean }>(`/group-sessions/${sessionId}/activities/${activityId}/delete`);
  return data;
}

export async function getSessionActivityResponses(sessionId: number, activityId: number) {
  const { data } = await api.get<SessionActivityResponseSet>(`/group-sessions/${sessionId}/activities/${activityId}/responses`);
  return data;
}

export async function getSessionInsights(sessionId: number) {
  return dedupeRead(`session-insights:${sessionId}`, async () => {
    const { data } = await api.get<SessionInsights>(`/group-sessions/${sessionId}/insights`);
    return data;
  });
}

export async function reviewSessionActivitySubmission(
  sessionId: number,
  activityId: number,
  submissionId: number,
  payload: { status: 'submitted' | 'approved' | 'rejected' | 'needs_revision'; score?: number; reviewComment?: string },
) {
  const { data } = await api.patch<{ ok: boolean }>(
    `/group-sessions/${sessionId}/activities/${activityId}/submissions/${submissionId}`,
    payload,
  );
  return data;
}

export async function generateAiFeedbackDraft(
  submissionId: number,
  payload: {
    submissionType: 'homework' | 'session_activity';
    language?: string;
    tone?: string;
    includeScoreSuggestion?: boolean;
  },
) {
  const { data } = await api.post<AiFeedbackDraftResponse>(`/ai-lms/submissions/${submissionId}/feedback-draft`, payload);
  return data;
}

export async function generateAiLessonQuizDraft(
  lessonId: number,
  payload: { language?: string; questionCount?: number; difficulty?: string; includeExplanations?: boolean },
) {
  const { data } = await api.post<AiQuizDraftResponse>(`/ai-lms/lessons/${lessonId}/quiz-draft`, payload);
  return data;
}

export async function generateAiSessionQuizDraft(
  sessionId: number,
  payload: { language?: string; questionCount?: number; difficulty?: string; includeExplanations?: boolean },
) {
  const { data } = await api.post<AiQuizDraftResponse>(`/ai-lms/sessions/${sessionId}/quiz-draft`, payload);
  return data;
}

export async function generateAiHomeworkDraft(
  sessionId: number,
  payload: { language?: string; topic?: string; instructions?: string; maxScore?: number },
) {
  const { data } = await api.post<AiHomeworkDraftResponse>(`/ai-lms/sessions/${sessionId}/homework-draft`, payload);
  return data;
}

export async function generateAiLessonKit(
  lessonId: number,
  payload: { language?: string; focus?: string },
) {
  const { data } = await api.post(`/ai-lms/lessons/${lessonId}/lesson-kit`, payload);
  return data;
}

export async function generateAiWorksheetDraft(
  sessionId: number,
  payload: { language?: string; topic?: string; activityCount?: number; includeAnswerKey?: boolean },
) {
  const { data } = await api.post<AiWorksheetDraftResponse>(`/ai-lms/sessions/${sessionId}/worksheet-draft`, payload);
  return data;
}

export async function generateAiCourseDraft(
  payload: {
    language?: string;
    topic: string;
    targetAudience?: string;
    level?: string;
    courseType?: 'video' | 'offline' | 'online_live';
    sectionCount?: number;
    lessonsPerSection?: number;
  },
) {
  const { data } = await api.post<AiCourseDraftResponse>('/ai-lms/courses/course-draft', payload);
  return data;
}

export async function generateAiMessageDraft(
  studentId: number,
  payload: { language?: string; recipient?: 'student' | 'guardian'; purpose?: string; tone?: 'supportive' | 'formal' | 'urgent'; courseId?: number },
) {
  const { data } = await api.post<AiMessageDraftResponse>(`/ai-lms/students/${studentId}/message-draft`, payload);
  return data;
}

export async function getAiLmsCapabilities(courseId?: number) {
  const { data } = await api.get<AiLmsCapabilities>('/ai-lms/capabilities', {
    params: courseId ? { courseId } : undefined,
  });
  return data;
}

export async function acceptAiGeneration(generationId: number) {
  const { data } = await api.patch<{ generationId: number; status: string; messageKey?: string }>(`/ai-lms/generations/${generationId}/accept`);
  return data;
}

export async function rejectAiGeneration(generationId: number) {
  const { data } = await api.patch<{ generationId: number; status: string; messageKey?: string }>(`/ai-lms/generations/${generationId}/reject`);
  return data;
}

export async function enrollUser(payload: {
  courseId: number;
  userId: number;
  groupId?: number;
  discountPercentage?: number;
}) {
  const { data } = await api.post('/enrollments/enroll', payload);
  return data;
}

export async function unenrollUser(courseId: number, userId: number) {
  const { data } = await api.delete(`/enrollments/${courseId}/unenroll/${userId}`);
  return data;
}

export async function removeUserFromGroup(groupId: number, userId: number) {
  const { data } = await api.delete(`/enrollments/groups/${groupId}/students/${userId}`);
  return data;
}

export async function listGroupStudents(groupId: number, params: {
  q?: string;
  progressGte?: number;
  progressLte?: number;
  limit?: number;
} = {}) {
  const requestKey = `group-students:${groupId}:${params.limit ?? 200}:${params.q ?? ''}:${params.progressGte ?? ''}:${params.progressLte ?? ''}`;
  return dedupeRead(requestKey, async () => {
    const { data } = await api.get<{ items?: GroupStudent[] } | GroupStudent[]>(`/course-groups/${groupId}/students`, {
      params: { limit: params.limit ?? 200, q: params.q, progressGte: params.progressGte, progressLte: params.progressLte },
    });
    return Array.isArray(data) ? data : data.items ?? [];
  });
}

export async function getSessionAttendance(sessionId: number) {
  return dedupeRead(`session-attendance:${sessionId}`, async () => {
    const { data } = await api.get<{ items?: AttendanceRecord[] } | AttendanceRecord[]>(`/attendance/sessions/${sessionId}`);
    return Array.isArray(data) ? data : data.items ?? [];
  });
}

export async function saveSessionAttendance(
  sessionId: number,
  rows: Array<{ studentId: number; status: AttendanceStatus; notes?: string }>,
) {
  const { data } = await api.post(`/attendance/sessions/${sessionId}/bulk`, { rows });
  return data;
}

export async function listSessionHomework(sessionId: number, includeUnpublished = true) {
  return dedupeRead(`session-homework:${sessionId}:${includeUnpublished ? 'all' : 'published'}`, async () => {
    const { data } = await api.get<SessionHomework[] | { items?: SessionHomework[] }>(`/group-sessions/${sessionId}/homework`, {
      params: { includeUnpublished },
    });
    return Array.isArray(data) ? data : data.items ?? [];
  });
}

export async function createSessionHomework(
  sessionId: number,
  payload: {
    title: string;
    description?: string;
    dueAt?: string;
    maxScore?: number;
    isPublished?: boolean;
    assignedStudentIds?: number[];
  },
) {
  const { data } = await api.post<SessionHomework>(`/group-sessions/${sessionId}/homework`, payload);
  return data;
}

export async function updateSessionHomework(
  sessionId: number,
  homeworkId: number,
  payload: {
    title?: string;
    description?: string | null;
    dueAt?: string | null;
    deadline?: string | null;
    maxScore?: number | null;
    isPublished?: boolean;
    assignedStudentIds?: number[] | null;
  },
) {
  const { data } = await api.patch<SessionHomework>(`/group-sessions/${sessionId}/homework/${homeworkId}`, payload);
  return data;
}

export async function deleteSessionHomework(sessionId: number, homeworkId: number) {
  const { data } = await api.delete<{ ok: boolean }>(`/group-sessions/${sessionId}/homework/${homeworkId}`);
  return data;
}

export async function getHomeworkReviewRoster(sessionId: number, homeworkId: number) {
  const { data } = await api.get<HomeworkReviewRoster>(`/group-sessions/${sessionId}/homework/${homeworkId}/review-roster`);
  return data;
}

export async function listHomeworkSubmissions(sessionId: number, homeworkId: number) {
  const { data } = await api.get<HomeworkSubmission[] | { items?: HomeworkSubmission[] }>(
    `/group-sessions/${sessionId}/homework/${homeworkId}/submissions`,
  );
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function openHomeworkSubmissionAttachment(sessionId: number, homeworkId: number, submissionId: number) {
  const { data } = await api.get<Blob>(
    `/group-sessions/${sessionId}/homework/${homeworkId}/submissions/${submissionId}/attachment`,
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(data);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function reviewHomeworkSubmission(
  sessionId: number,
  homeworkId: number,
  submissionId: number,
  payload: { status: 'approved' | 'rejected' | 'needs_revision'; score?: number; reviewComment?: string },
) {
  const { data } = await api.patch<HomeworkSubmission>(
    `/group-sessions/${sessionId}/homework/${homeworkId}/submissions/${submissionId}`,
    payload,
  );
  return data;
}

export async function listTenantMembers(tenantId: number) {
  return dedupeRead(`tenant:${tenantId}:members`, async () => {
    const { data } = await api.get<{ items?: CompanyMember[] } | CompanyMember[]>(`/companies/${tenantId}/members`);
    return Array.isArray(data) ? data : data.items ?? [];
  });
}

export async function addTenantMember(tenantId: number, payload: { userId: number; role: string }) {
  const { data } = await api.post<{
    userId: number;
    companyId: number;
    role: string;
    messageKey?: string;
    onboarding?: { setupLink?: string; expiresAt?: string; emailSent?: boolean } | null;
  }>(`/companies/${tenantId}/members`, payload);
  return data;
}

export async function resolveTenantMemberCandidate(
  tenantId: number,
  lookup: { email?: string; phoneNumber?: string },
) {
  const { data } = await api.get<TenantMemberResolveResult>(`/companies/${tenantId}/members/resolve`, {
    params: {
      email: lookup.email?.trim() || undefined,
      phoneNumber: lookup.phoneNumber?.trim() || undefined,
    },
  });
  return data;
}

export async function inviteTenantMember(
  tenantId: number,
  payload: { email: string; fullName: string; role: string; sendEmail?: boolean },
) {
  const { data } = await api.post<{
    userId: number;
    email: string;
    fullName?: string;
    role: string;
    alreadyMember?: boolean;
    onboarding?: { setupLink?: string; expiresAt?: string; emailSent?: boolean } | null;
  }>(`/companies/${tenantId}/invitations`, payload);
  return data;
}

export async function resendTenantInvitation(
  tenantId: number,
  userId: number,
  payload: { sendEmail?: boolean } = {},
) {
  const { data } = await api.post<{
    ok: true;
    messageKey?: string;
    user?: { id: number; email: string; fullName?: string };
    roles?: string[];
    onboarding?: { setupLink?: string; expiresAt?: string; emailSent?: boolean } | null;
  }>(`/companies/${tenantId}/invitations/${userId}/resend`, payload);
  return data;
}

export async function setTenantMemberRole(
  tenantId: number,
  userId: number,
  payload: { role: string; mode?: 'replace' | 'add'; fromRole?: string },
) {
  const { data } = await api.patch(`/companies/${tenantId}/members/${userId}`, payload);
  return data;
}

export async function removeTenantMember(tenantId: number, userId: number, role?: string) {
  const { data } = await api.delete(`/companies/${tenantId}/members/${userId}`, {
    params: role ? { role } : undefined,
  });
  return data;
}

export async function getCertificateBranding(tenantId: number) {
  const { data } = await api.get<CertificateBranding>(`/companies/${tenantId}/certificate-branding`);
  return data;
}

export async function updateCertificateBranding(tenantId: number, patch: Partial<CertificateBranding>) {
  const { data } = await api.patch<CertificateBranding>(`/companies/${tenantId}/certificate-branding`, patch);
  return data;
}

export async function uploadCertificateLogo(tenantId: number, file: File) {
  const form = new FormData();
  form.append('logo', file);
  const { data } = await api.post<CertificateBranding>(`/companies/${tenantId}/certificate-branding/upload-logo`, form);
  return data;
}

export async function getCourseCertificateSettings(courseId: number) {
  const { data } = await api.get<CourseCertificateSettings>(`/courses/${courseId}/certificate-settings`);
  return data;
}

export async function updateCourseCertificateSettings(courseId: number, patch: Partial<CourseCertificateSettings>) {
  const { data } = await api.patch<CourseCertificateSettings>(`/courses/${courseId}/certificate-settings`, patch);
  return data;
}

export async function previewCourseCertificate(courseId: number, payload: Partial<CourseCertificateSettings> & {
  previewStudentName?: string;
  previewCourseTitle?: string;
  previewIssuerName?: string;
  previewIssuerTitle?: string;
  previewIssuedAt?: string;
}) {
  const { data } = await api.post<string>(`/courses/${courseId}/certificate-preview`, payload, {
    responseType: 'text',
  });
  return data;
}

export async function uploadCourseCertificateSignature(courseId: number, file: File) {
  const form = new FormData();
  form.append('signature', file);
  const { data } = await api.post<CourseCertificateSettings>(
    `/courses/${courseId}/certificate-settings/upload-signature`,
    form,
  );
  return data;
}

export async function uploadCourseCertificateSecondaryLogo(courseId: number, file: File) {
  const form = new FormData();
  form.append('logo', file);
  const { data } = await api.post<CourseCertificateSettings>(
    `/courses/${courseId}/certificate-settings/upload-secondary-logo`,
    form,
  );
  return data;
}

export async function listCourseCertificates(courseId: number) {
  const { data } = await api.get<CourseCertificate[] | { items?: CourseCertificate[] }>(`/courses/${courseId}/certificates`);
  return Array.isArray(data) ? data : data.items ?? [];
}

function triggerBrowserDownload(downloadUrl: string, fallbackName?: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  if (fallbackName) link.download = fallbackName;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function shouldUseApiDownload(downloadUrl: string) {
  if (downloadUrl.startsWith('/')) return true;
  try {
    const parsedUrl = new URL(downloadUrl, window.location.origin);
    const apiBaseUrl = new URL(API_BASE_URL, window.location.origin);
    return parsedUrl.origin === apiBaseUrl.origin;
  } catch {
    return true;
  }
}

export async function downloadCertificatePdf(downloadUrl: string, fallbackName = 'certificate.pdf') {
  if (!shouldUseApiDownload(downloadUrl)) {
    triggerBrowserDownload(downloadUrl, fallbackName);
    return;
  }

  const { data, headers } = await api.get<Blob>(downloadUrl, { responseType: 'blob' });
  const disposition = String(headers['content-disposition'] ?? '');
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(data);
  triggerBrowserDownload(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function issueCourseCertificate(
  courseId: number,
  payload: {
    studentId: number;
    studentFullName?: string;
    issuerDisplayName?: string;
    issuerTitle?: string;
    certificateLanguage?: 'en' | 'ru' | 'ky';
    pageOrientation?: 'landscape' | 'portrait';
    note?: string;
    allowEligibilityOverride?: boolean;
  },
) {
  const { data } = await api.post<CourseCertificate>(`/courses/${courseId}/certificates/issue`, payload);
  return data;
}

export async function approveCertificate(certificateId: number, payload: {
  studentFullName?: string;
  issuerDisplayName?: string;
  issuerTitle?: string;
  certificateLanguage?: 'en' | 'ru' | 'ky';
  pageOrientation?: 'landscape' | 'portrait';
  reason?: string;
} = {}) {
  const { data } = await api.post<CourseCertificate>(`/certificates/${certificateId}/approve`, payload);
  return data;
}

export async function rejectCertificate(certificateId: number, reason?: string) {
  const { data } = await api.post<CourseCertificate>(`/certificates/${certificateId}/reject`, { reason });
  return data;
}

export async function revokeCertificate(certificateId: number, reason?: string) {
  const { data } = await api.post<CourseCertificate>(`/certificates/${certificateId}/revoke`, { reason });
  return data;
}

export async function regenerateCourseCertificates(courseId: number, certificateId?: number) {
  const { data } = await api.post<{ regeneratedCount: number; items: Array<{ certificateId: number; publicId: string; fileKey: string | null }> }>(
    `/courses/${courseId}/certificates/regenerate`,
    certificateId ? { certificateId } : {},
  );
  return data;
}

export async function getHomeworkSummary(courseId?: number, groupId?: number) {
  const { data } = await api.get('/homework/summary', { params: { courseId, groupId } });
  return data;
}

export async function getHomeworkReviewQueue(params: { limit?: number; courseId?: number; groupId?: number } = {}) {
  const { data } = await api.get<HomeworkReviewQueue>('/homework/review-queue', { params });
  return data;
}

export async function listHomework(courseId?: number, groupId?: number) {
  const { data } = await api.get<SessionHomework[] | { items?: SessionHomework[] }>('/homework', { params: { courseId, groupId } });
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function getActivityReviewQueue(params: { limit?: number; courseId?: number; groupId?: number } = {}) {
  const { data } = await api.get<ActivityReviewQueue>('/group-sessions/activity-review-queue', { params });
  return data;
}

export async function getStudentDashboard(params: { courseId?: number; groupId?: number; limit?: number } = {}) {
  const { data } = await api.get('/student/dashboard', { params });
  return data;
}

export async function getStudentHome(params: { courseId?: number; groupId?: number; limit?: number } = {}) {
  const { data } = await api.get('/student/home', { params });
  return data;
}

export async function listStudentCourses() {
  const { data } = await api.get<StudentCourseSummary[] | { items?: StudentCourseSummary[]; courses?: StudentCourseSummary[] }>('/student/courses');
  return Array.isArray(data) ? data : data?.items ?? data?.courses ?? [];
}

export async function getStudentCourseDetail(courseId: number) {
  const { data } = await api.get<StudentCourseDetail | null>(`/student/courses/${courseId}`);
  return data;
}

export async function listStudentUpcomingSessions(params: { courseId?: number; groupId?: number; limit?: number } = {}) {
  const { data } = await api.get<StudentSessionSummary[] | { items?: StudentSessionSummary[] }>('/student/sessions/upcoming', { params });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function getStudentSessionDetail(sessionId: number) {
  const { data } = await api.get<StudentSessionDetail | null>(`/student/sessions/${sessionId}`);
  return data;
}

export async function listStudentResources(params: { courseId?: number; groupId?: number; limit?: number; page?: number; type?: string; from?: string; to?: string } = {}) {
  const page = await getStudentResourcesPage(params);
  return page.items;
}

export async function getStudentResourcesPage(params: { courseId?: number; groupId?: number; limit?: number; page?: number; type?: string; from?: string; to?: string } = {}) {
  const { data } = await api.get<Array<StudentSessionSummary | StudentMaterialItem> | StudentPagedResponse<StudentSessionSummary | StudentMaterialItem>>('/student/resources', { params });
  return toStudentPage(data);
}

export async function listStudentRecordings(params: { courseId?: number; groupId?: number; limit?: number; page?: number; from?: string; to?: string } = {}) {
  const page = await getStudentRecordingsPage(params);
  return page.items;
}

export async function getStudentRecordingsPage(params: { courseId?: number; groupId?: number; limit?: number; page?: number; from?: string; to?: string } = {}) {
  const { data } = await api.get<Array<StudentSessionSummary | StudentMaterialItem> | StudentPagedResponse<StudentSessionSummary | StudentMaterialItem>>('/student/recordings', { params });
  return toStudentPage(data);
}

export async function listStudentHomework(params: { courseId?: number; groupId?: number; limit?: number } = {}) {
  const { data } = await api.get<StudentHomeworkItem[] | { items?: StudentHomeworkItem[] }>('/student/homework', { params });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function listStudentCertificates(params: { courseId?: number; groupId?: number; limit?: number; page?: number; status?: string; from?: string; to?: string } = {}) {
  const page = await getStudentCertificatesPage(params);
  return page.items;
}

export async function getStudentCertificatesPage(params: { courseId?: number; groupId?: number; limit?: number; page?: number; status?: string; from?: string; to?: string } = {}) {
  const { data } = await api.get<StudentCertificateSummary[] | (StudentPagedResponse<StudentCertificateSummary> & { certificates?: StudentCertificateSummary[] })>('/student/certificates', { params });
  if (!Array.isArray(data) && data.certificates && !data.items) {
    return toStudentPage({ ...data, items: data.certificates });
  }
  return toStudentPage(data);
}

export async function listStudentAttendance(params: { courseId?: number; groupId?: number; limit?: number; from?: string; to?: string } = {}) {
  const { data } = await api.get('/student/attendance', { params });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function getStudentProgressSummary(params: { courseId?: number; groupId?: number; limit?: number; from?: string; to?: string } = {}) {
  const { data } = await api.get<StudentProgressSummary | null>('/student/progress/summary', { params });
  return data;
}

export async function listStudentTasks(params: { courseId?: number; groupId?: number; limit?: number; page?: number; status?: string; from?: string; to?: string } = {}) {
  const page = await getStudentTasksPage(params);
  return page.items;
}

export async function getStudentTasksPage(params: { courseId?: number; groupId?: number; limit?: number; page?: number; status?: string; from?: string; to?: string } = {}) {
  const { data } = await api.get<StudentTaskItem[] | StudentPagedResponse<StudentTaskItem>>('/student/tasks', { params });
  return toStudentPage(data);
}

export async function getStudentSupportOptions() {
  const { data } = await api.get<StudentSupportOptions | null>('/student/support/options');
  return data;
}

export async function getStudentNotificationSettings() {
  const { data } = await api.get('/student/notification-settings');
  return data;
}

export async function updateStudentNotificationSettings(payload: {
  notifyByEmail: boolean;
  notifyByWhatsApp: boolean;
  notifyByTelegram: boolean;
  language?: string | null;
  timezone?: string | null;
}) {
  const { data } = await api.patch('/student/notification-settings', payload);
  return data;
}

export async function getStudentNotificationsPage(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<StudentNotificationPage>('/student/notifications', { params });
  return data;
}

export async function markAllStudentNotificationsRead() {
  const { data } = await api.post('/student/notifications/read-all');
  return data;
}

export async function listStudentReminders(params: { courseId?: number; groupId?: number; page?: number; limit?: number; from?: string; to?: string } = {}) {
  const { data } = await api.get<StudentReminder[] | { items?: StudentReminder[] }>('/student/reminders', { params });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function listStudentSupportRequests(params: { page?: number; limit?: number; status?: string } = {}) {
  const { data } = await api.get<StudentSupportRequest[] | { items?: StudentSupportRequest[] }>('/student/support/requests', { params });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function createStudentSupportRequest(payload: {
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  message: string;
  courseId?: number;
  sessionId?: number;
}) {
  const { data } = await api.post<StudentSupportRequest>('/student/support/requests', payload);
  return data;
}

export async function submitStudentHomework(
  sessionId: number,
  homeworkId: number,
  payload: { answerText?: string; linkUrl?: string; attachmentUrl?: string; attachmentKey?: string },
) {
  const { data } = await api.post(`/student/sessions/${sessionId}/homework/${homeworkId}/submissions`, payload);
  return data;
}

export async function uploadStudentHomeworkAttachment(sessionId: number, homeworkId: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/student/sessions/${sessionId}/homework/${homeworkId}/submissions/upload`, form);
  return data as { key: string; url: string; fileName: string; contentType: string; size: number };
}

export async function submitStudentActivity(
  sessionId: number,
  activityId: number,
  payload: { text?: string; link?: string; attachmentUrl?: string; attachmentKey?: string },
) {
  const { data } = await api.post(`/student/sessions/${sessionId}/activities/${activityId}/submit`, payload);
  return data;
}

export async function uploadStudentActivityAttachment(sessionId: number, activityId: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/student/sessions/${sessionId}/activities/${activityId}/submissions/upload`, form);
  return data as { key: string; url: string; fileName: string; contentType: string; size: number };
}

export async function submitStudentActivityQuiz(
  sessionId: number,
  activityId: number,
  answers: Array<{ questionId: number; optionIds: number[] }>,
) {
  const { data } = await api.post(`/student/sessions/${sessionId}/activities/${activityId}/quiz-attempt`, { answers });
  return data;
}
