import axios from 'axios';
import type {
  AttendanceRecord,
  AttendanceStatus,
  ActivityReviewQueue,
  AssistantDashboard,
  AssistantSupportResponse,
  AssistantSupportStatus,
  AuthUser,
  CertificateBranding,
  CourseCertificate,
  CourseCertificateSettings,
  CompanyMember,
  Course,
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
  StudentAccessState,
  StudentCertificateSummary,
  StudentCourseDetail,
  StudentCourseSummary,
  StudentHomeworkItem,
  StudentMaterialItem,
  StudentNotification,
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
  UserSummary,
  WorkspaceListResponse,
} from '../types/domain';
import { getCurrentLocale } from '../i18n/locale';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipTenantHeader?: boolean;
    __csrfRetry?: boolean;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'edubot_tenant_token';
const TENANT_KEY = 'edubot_active_tenant_id';

export type StudentPagedResponse<T> = {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

function toStudentPage<T>(data: T[] | StudentPagedResponse<T>): StudentPagedResponse<T> {
  return Array.isArray(data)
    ? { items: data, total: data.length, page: 1, limit: data.length, totalPages: 1 }
    : { ...data, items: data.items ?? [], totalPages: data.totalPages ?? (data.total && data.limit ? Math.ceil(data.total / data.limit) : undefined) };
}

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY),
  set: (token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },
};

export const tenantStore = {
  get: () => {
    const value = localStorage.getItem(TENANT_KEY);
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  },
  set: (tenantId: number) => localStorage.setItem(TENANT_KEY, String(tenantId)),
  clear: () => localStorage.removeItem(TENANT_KEY),
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const AUTH_EXPIRED_EVENT = 'edubot_tenant_auth_expired';
const CSRF_ERROR_TEXT = 'CSRF token missing or invalid';

function getCookieValue(name: string) {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = tenantStore.get();
  if (config.skipTenantHeader) {
    delete config.headers['X-Company-Id'];
  } else if (tenantId) {
    config.headers['X-Company-Id'] = String(tenantId);
  }
  const method = String(config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCookieValue('edubot_csrf_token');
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  }
  config.headers['Accept-Language'] = getCurrentLocale();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message = error?.response?.data?.message;
    const isCsrfError =
      error?.response?.status === 403 &&
      (Array.isArray(message)
        ? message.includes(CSRF_ERROR_TEXT)
        : String(message || '').includes(CSRF_ERROR_TEXT));

    if (isCsrfError && error.config && !error.config.__csrfRetry) {
      error.config.__csrfRetry = true;
      try {
        await api.get('/auth/profile', { skipTenantHeader: true, __csrfRetry: true });
        return api(error.config);
      } catch {
        return Promise.reject(error);
      }
    }

    if (error?.response?.status === 401) {
      tokenStore.clear();
      tenantStore.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

type LoginResponse = {
  token?: string;
  access_token?: string;
  user?: AuthUser;
};

function storeAuthToken(data: LoginResponse) {
  const token = data.token || data.access_token;
  if (token) tokenStore.set(token);
  return token;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  const token = storeAuthToken(data);
  if (!token) throw new Error('Login response did not include a token');
  return data.user ?? getCurrentUser();
}

export async function completeAccountSetup(payload: { token: string; newPassword: string }) {
  const { data } = await api.post<LoginResponse>('/auth/setup-account', payload);
  const token = storeAuthToken(data);
  if (!token) throw new Error('Account setup response did not include a token');
  return data.user ?? getCurrentUser();
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function requestPasswordReset(payload: { identifier: string; method: 'email' | 'whatsapp' | 'telegram' }) {
  const { data } = await api.post<{ message?: string }>('/auth/forgot-password', payload);
  return data;
}

export async function resetPassword(payload: {
  identifier: string;
  method: 'email' | 'whatsapp' | 'telegram';
  otp: string;
  newPassword: string;
}) {
  const { data } = await api.post<{ message?: string }>('/auth/reset-password', payload);
  return data;
}

export async function getCurrentUser() {
  const { data } = await api.get<AuthUser>('/auth/profile');
  return data;
}

export async function searchUsers(params: { search?: string; role?: string; limit?: number } = {}) {
  const { data } = await api.get<{ data?: UserSummary[]; items?: UserSummary[] } | UserSummary[]>('/users', {
    params: {
      page: 1,
      limit: params.limit ?? 10,
      search: params.search,
      role: params.role,
    },
  });
  if (Array.isArray(data)) return data;
  return data.data ?? data.items ?? [];
}

export async function listMyTenants() {
  const { data } = await api.get<{ items?: Tenant[] } | Tenant[]>('/companies/mine', {
    params: { limit: 100 },
  });
  return Array.isArray(data) ? data : data.items ?? [];
}

function tenantFromWorkspace(item: WorkspaceListResponse['items'][number]): Tenant | null {
  if (item.type !== 'tenant' || !item.companyId) return null;
  return {
    id: item.companyId,
    name: item.name,
    role: item.role,
    roles: item.roles,
    membershipStatus: item.membershipStatus,
    status: item.status ?? item.availability?.status ?? undefined,
    plan: item.plan,
    billingStatus: item.billingStatus,
    featureFlags: item.featureFlags ?? undefined,
    timezone: item.timezone,
    locale: item.locale,
    availability: item.availability,
    permissions: item.permissions,
    branding: item.branding,
    logoUrl: item.logoUrl,
    host: item.host,
    crmLink: item.crmLink,
    crmTenantId: item.crmLink?.crmTenantId ?? undefined,
    crmTenantSlug: item.crmLink?.crmTenantSlug ?? undefined,
    crmPrimaryDomain: item.crmLink?.crmPrimaryDomain ?? undefined,
  };
}

export async function listTenantWorkspaces() {
  const { data } = await api.get<WorkspaceListResponse>('/companies/workspaces', {
    skipTenantHeader: true,
  });
  return {
    ...data,
    tenantItems: (data.items ?? []).filter((item) => item.type === 'tenant'),
    tenants: (data.items ?? [])
      .map(tenantFromWorkspace)
      .filter((tenant): tenant is Tenant => Boolean(tenant)),
  };
}

export async function switchTenantWorkspace(tenantId: number) {
  const { data } = await api.post<{ active: WorkspaceListResponse['items'][number] }>('/companies/workspaces/switch', {
    type: 'tenant',
    companyId: tenantId,
  }, {
    skipTenantHeader: true,
  });
  const tenant = tenantFromWorkspace(data.active);
  if (!tenant) throw new Error('Workspace switch response did not include a tenant workspace');
  return tenant;
}

export async function resolveTenantByHost(host: string) {
  const { data } = await api.get<Tenant & { resolvedHost?: string }>('/tenant-context/resolve', {
    params: { host },
    skipTenantHeader: true,
  });
  return data;
}

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
  const { data } = await api.get<{ items?: Course[] } | Course[]>(`/companies/${tenantId}/courses`, {
    params: { limit: 100 },
  });
  return Array.isArray(data) ? data : data.items ?? [];
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
  instructorId?: number;
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
  instructorId?: number;
}) {
  const { data } = await api.patch<Course>(`/courses/${courseId}`, {
    ...payload,
    visibility: 'PRIVATE',
  });
  return data;
}

export async function updateCourseStatus(courseId: number, status: 'pending' | 'approved' | 'rejected') {
  const { data } = await api.patch<{ success: boolean; status: string }>(`/courses/${courseId}/status`, { status });
  return data;
}

export async function listCourseGroups(courseId?: number) {
  const { data } = await api.get<{ items?: CourseGroup[] } | CourseGroup[]>('/course-groups', {
    params: courseId ? { courseId } : undefined,
  });
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function createCourseGroup(payload: {
  courseId: number;
  name: string;
  code: string;
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

export async function updateCourseGroup(groupId: number, payload: {
  name?: string;
  code?: string;
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

export async function listGroupSessions(groupId?: number) {
  const { data } = await api.get<{ items?: CourseSession[] } | CourseSession[]>('/group-sessions', {
    params: groupId ? { groupId } : undefined,
  });
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function createGroupSession(payload: {
  groupId: number;
  sessionIndex: number;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}) {
  const { data } = await api.post<CourseSession>('/group-sessions', payload);
  return data;
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
  const { data } = await api.get<LiveMeeting>(`/live-integration/sessions/${sessionId}/meeting`, {
    params: provider ? { provider } : undefined,
  });
  return data;
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
  const { data } = await api.get<SessionInsights>(`/group-sessions/${sessionId}/insights`);
  return data;
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

export async function listGroupStudents(groupId: number, params: {
  q?: string;
  progressGte?: number;
  progressLte?: number;
  limit?: number;
} = {}) {
  const { data } = await api.get<{ items?: GroupStudent[] } | GroupStudent[]>(`/course-groups/${groupId}/students`, {
    params: { limit: params.limit ?? 200, q: params.q, progressGte: params.progressGte, progressLte: params.progressLte },
  });
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function getSessionAttendance(sessionId: number) {
  const { data } = await api.get<{ items?: AttendanceRecord[] } | AttendanceRecord[]>(`/attendance/sessions/${sessionId}`);
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function saveSessionAttendance(
  sessionId: number,
  rows: Array<{ studentId: number; status: AttendanceStatus; notes?: string }>,
) {
  const { data } = await api.post(`/attendance/sessions/${sessionId}/bulk`, { rows });
  return data;
}

export async function listSessionHomework(sessionId: number, includeUnpublished = true) {
  const { data } = await api.get<SessionHomework[] | { items?: SessionHomework[] }>(`/group-sessions/${sessionId}/homework`, {
    params: { includeUnpublished },
  });
  return Array.isArray(data) ? data : data.items ?? [];
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
  const { data } = await api.get<{ items?: CompanyMember[] } | CompanyMember[]>(`/companies/${tenantId}/members`);
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function addTenantMember(tenantId: number, payload: { userId: number; role: string }) {
  const { data } = await api.post(`/companies/${tenantId}/members`, payload);
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
  const { data } = await api.post(`/companies/${tenantId}/invitations/${userId}/resend`, payload);
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

export async function getStudentAccess() {
  const { data } = await api.get<StudentAccessState>('/student/access');
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

export async function listStudentNotifications(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<StudentNotification[] | { items?: StudentNotification[] }>('/student/notifications', { params });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export async function getStudentNotificationsPage(params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get<StudentNotificationPage>('/student/notifications', { params });
  return data;
}

export async function getStudentNotificationUnreadCount() {
  const { data } = await api.get('/student/notifications/unread-count');
  return data;
}

export async function markStudentNotificationRead(notificationId: number) {
  const { data } = await api.post(`/student/notifications/${notificationId}/read`);
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
  payload: { answerText?: string; attachmentUrl?: string },
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
