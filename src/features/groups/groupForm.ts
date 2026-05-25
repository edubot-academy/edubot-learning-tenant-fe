import type { CourseGroup } from '../../types/domain';

export type GroupStatus = 'planned' | 'open' | 'active' | 'completed' | 'cancelled';
export type DeliveryMode = 'group' | 'individual';
export type ScheduleDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ScheduleBlockForm = { day: ScheduleDay; startTime: string; endTime: string };

export type GroupForm = {
  name: string;
  code: string;
  deliveryMode: DeliveryMode;
  status: GroupStatus;
  startDate: string;
  endDate: string;
  seatLimit: string;
  timezone: string;
  location: string;
  meetingProvider: string;
  meetingUrl: string;
  scheduleNote: string;
  scheduleBlocks: ScheduleBlockForm[];
  instructorId: string;
  createFirstSession: boolean;
};

export type GroupValidationMessages = {
  groupNameRequired: string;
  selectStudentForIndividual?: string;
  studentNameEmailRequired?: string;
  endDateAfterStart: string;
  seatLimitInvalid: string;
  timezoneInvalid: string;
  meetingUrlInvalid: string;
  scheduleBlockIncomplete: string;
  scheduleTimeInvalid: string;
  createFirstSessionSetupRequired?: string;
  liveMeetingRequired?: string;
  courseRequired?: string;
};

export type GroupValidationOptions = {
  mode: 'create' | 'edit';
  requireCourse?: boolean;
  deliveryMode?: DeliveryMode;
  enrollmentMode?: 'existing' | 'new';
  selectedStudentId?: number;
  newStudent?: { fullName: string; email: string };
  createFirstSession?: boolean;
  requireOnlineLiveIndividualSetup?: boolean;
};

export type GroupValidationErrors = Partial<Record<
  'course' | 'groupName' | 'name' | 'student' | 'dates' | 'seatLimit' | 'timezone' | 'meetingUrl' | 'schedule',
  string
>>;

export const emptyScheduleBlock = (): ScheduleBlockForm => ({
  day: 'mon',
  startTime: '',
  endTime: '',
});

export const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const emptyGroupForm = (timezone = browserTimezone()): GroupForm => ({
  name: '',
  code: '',
  deliveryMode: 'group',
  status: 'planned',
  startDate: '',
  endDate: '',
  seatLimit: '',
  timezone,
  location: '',
  meetingProvider: '',
  meetingUrl: '',
  scheduleNote: '',
  scheduleBlocks: [emptyScheduleBlock()],
  instructorId: '',
  createFirstSession: false,
});

export function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function validScheduleDay(value: unknown): value is ScheduleDay {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(String(value));
}

export function groupToForm(group?: CourseGroup | null, fallbackTimezone = browserTimezone()): GroupForm {
  const scheduleBlocks = Array.isArray(group?.scheduleBlocks) && group.scheduleBlocks.length
    ? group.scheduleBlocks.map((block) => ({
      day: validScheduleDay(block.day) ? block.day : 'mon',
      startTime: block.startTime ?? '',
      endTime: block.endTime ?? '',
    }))
    : [emptyScheduleBlock()];
  if (!group) return emptyGroupForm(fallbackTimezone);
  return {
    name: group.name ?? '',
    code: group.code ?? '',
    deliveryMode: group.deliveryMode ?? 'group',
    status: ['planned', 'open', 'active', 'completed', 'cancelled'].includes(String(group.status))
      ? group.status as GroupStatus
      : 'planned',
    startDate: group.startDate?.slice(0, 10) ?? '',
    endDate: group.endDate?.slice(0, 10) ?? '',
    seatLimit: group.seatLimit ? String(group.seatLimit) : '',
    timezone: group.timezone ?? fallbackTimezone,
    location: group.location ?? '',
    meetingProvider: group.meetingProvider ?? '',
    meetingUrl: group.meetingUrl ?? '',
    scheduleNote: group.scheduleNote ?? '',
    scheduleBlocks,
    instructorId: group.instructorId ? String(group.instructorId) : '',
    createFirstSession: false,
  };
}

export function scheduleBlocksPayload(blocks: ScheduleBlockForm[]) {
  return blocks
    .map((block) => ({
      day: block.day,
      startTime: block.startTime,
      endTime: block.endTime,
    }))
    .filter((block) => block.day && block.startTime && block.endTime);
}

export function isValidTimezone(value: string) {
  if (!value.trim()) return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function isValidMeetingUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function validateGroupForm(
  form: GroupForm,
  messages: GroupValidationMessages,
  options: GroupValidationOptions,
) {
  const nextErrors: GroupValidationErrors = {};
  const seatLimit = form.seatLimit.trim();
  const deliveryMode = options.deliveryMode ?? form.deliveryMode;
  const createFirstSession = options.createFirstSession ?? form.createFirstSession;
  const requiresOnlineLiveIndividualSetup = options.requireOnlineLiveIndividualSetup && deliveryMode === 'individual';
  const hasPartialSchedule = form.scheduleBlocks.some((block) => Boolean(block.startTime || block.endTime) && !(block.day && block.startTime && block.endTime));
  const hasInvalidScheduleTime = form.scheduleBlocks.some((block) => block.startTime && block.endTime && block.endTime <= block.startTime);

  if (options.mode === 'create' && options.requireCourse && messages.courseRequired) nextErrors.course = messages.courseRequired;
  if (!form.name.trim()) {
    nextErrors.name = messages.groupNameRequired;
    nextErrors.groupName = messages.groupNameRequired;
  }
  if (options.mode === 'create' && deliveryMode === 'individual' && options.enrollmentMode === 'existing' && !options.selectedStudentId && messages.selectStudentForIndividual) {
    nextErrors.student = messages.selectStudentForIndividual;
  }
  if (options.mode === 'create' && deliveryMode === 'individual' && options.enrollmentMode === 'new' && (!options.newStudent?.fullName.trim() || !options.newStudent?.email.trim()) && messages.studentNameEmailRequired) {
    nextErrors.student = messages.studentNameEmailRequired;
  }
  if (form.startDate && form.endDate && form.endDate < form.startDate) nextErrors.dates = messages.endDateAfterStart;
  if (seatLimit && (!Number.isInteger(Number(seatLimit)) || Number(seatLimit) < 1)) nextErrors.seatLimit = messages.seatLimitInvalid;
  if (!isValidTimezone(form.timezone)) nextErrors.timezone = messages.timezoneInvalid;
  if (!isValidMeetingUrl(form.meetingUrl)) nextErrors.meetingUrl = messages.meetingUrlInvalid;
  if (hasPartialSchedule) nextErrors.schedule = messages.scheduleBlockIncomplete;
  else if (hasInvalidScheduleTime) nextErrors.schedule = messages.scheduleTimeInvalid;
  else if (options.mode === 'create' && deliveryMode === 'individual' && (createFirstSession || requiresOnlineLiveIndividualSetup) && (!form.startDate || !scheduleBlocksPayload(form.scheduleBlocks).length) && messages.createFirstSessionSetupRequired) {
    nextErrors.schedule = messages.createFirstSessionSetupRequired;
  }
  if (!nextErrors.schedule && requiresOnlineLiveIndividualSetup && !form.meetingUrl.trim() && messages.liveMeetingRequired) {
    nextErrors.meetingUrl = messages.liveMeetingRequired;
  }

  return nextErrors;
}
