import { describe, expect, it } from 'vitest';
import { emptyGroupForm, groupToForm, scheduleBlocksPayload, validateGroupForm } from './groupForm';

const messages = {
  groupNameRequired: 'Name required',
  endDateAfterStart: 'Bad date range',
  seatLimitInvalid: 'Bad seat limit',
  timezoneInvalid: 'Bad timezone',
  meetingUrlInvalid: 'Bad URL',
  scheduleBlockIncomplete: 'Incomplete schedule',
  scheduleTimeInvalid: 'Bad schedule time',
  createFirstSessionSetupRequired: 'First session needs setup',
};

describe('group form helpers', () => {
  it('defaults new groups to planned with the provided timezone', () => {
    expect(emptyGroupForm('Asia/Bishkek')).toMatchObject({
      status: 'planned',
      timezone: 'Asia/Bishkek',
      deliveryMode: 'group',
    });
  });

  it('normalizes course group domain data into form state', () => {
    expect(groupToForm({
      id: 1,
      courseId: 2,
      name: 'Group A',
      status: 'active',
      deliveryMode: 'individual',
      startDate: '2026-05-21T00:00:00.000Z',
      scheduleBlocks: [{ day: 'fri', startTime: '10:00', endTime: '11:00' }],
    }, 'UTC')).toMatchObject({
      name: 'Group A',
      status: 'active',
      deliveryMode: 'individual',
      startDate: '2026-05-21',
      timezone: 'UTC',
      scheduleBlocks: [{ day: 'fri', startTime: '10:00', endTime: '11:00' }],
    });
  });

  it('filters incomplete schedule blocks from payloads', () => {
    expect(scheduleBlocksPayload([
      { day: 'mon', startTime: '10:00', endTime: '11:00' },
      { day: 'tue', startTime: '', endTime: '12:00' },
    ])).toEqual([{ day: 'mon', startTime: '10:00', endTime: '11:00' }]);
  });

  it('returns validation errors for invalid group setup', () => {
    const form = {
      ...emptyGroupForm('Invalid/Zone'),
      name: '',
      startDate: '2026-05-22',
      endDate: '2026-05-21',
      seatLimit: '1.5',
      meetingUrl: 'ftp://example.test',
      scheduleBlocks: [{ day: 'mon' as const, startTime: '11:00', endTime: '10:00' }],
    };

    expect(validateGroupForm(form, messages, { mode: 'create' })).toMatchObject({
      name: 'Name required',
      groupName: 'Name required',
      dates: 'Bad date range',
      seatLimit: 'Bad seat limit',
      timezone: 'Bad timezone',
      meetingUrl: 'Bad URL',
      schedule: 'Bad schedule time',
    });
  });
});
