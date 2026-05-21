import { describe, expect, it } from 'vitest';
import type { CompanyMember } from '../../types/domain';
import {
  canChangeMemberRole,
  canManageMemberRoleAssignment,
  getAssignableTenantRoles,
  getMemberInviteState,
  getRolesByUser,
  hasDuplicateTenantRole,
  memberEmail,
  memberName,
} from './memberAccess';

const members: CompanyMember[] = [
  { userId: 1, role: 'student', fullName: 'Local Name', email: 'local@example.com' },
  { userId: 1, role: 'instructor', user: { id: 1, fullName: 'User Name', email: 'user@example.com' } },
  { userId: 2, role: 'assistant' },
];

describe('member access helpers', () => {
  it('prefers linked user profile display values', () => {
    expect(memberName(members[1])).toBe('User Name');
    expect(memberEmail(members[1])).toBe('user@example.com');
    expect(memberName(members[2])).toBe('User 2');
  });

  it('groups roles by user id', () => {
    expect(getRolesByUser(members)).toEqual({
      1: ['student', 'instructor'],
      2: ['assistant'],
    });
  });

  it('detects duplicate tenant role assignments', () => {
    const rolesByUser = getRolesByUser(members);

    expect(hasDuplicateTenantRole(rolesByUser, 1, 'student')).toBe(true);
    expect(hasDuplicateTenantRole(rolesByUser, 1, 'assistant')).toBe(false);
  });

  it('blocks role changes that would duplicate another assignment', () => {
    const rolesByUser = getRolesByUser(members);

    expect(canChangeMemberRole(rolesByUser, members[1], 'student')).toBe(false);
    expect(canChangeMemberRole(rolesByUser, members[1], 'assistant')).toBe(true);
  });

  it('keeps owner role controls behind owner permission and protects the last owner', () => {
    const owner: CompanyMember = { userId: 3, role: 'owner' };

    expect(canManageMemberRoleAssignment(true, false, owner, 2)).toBe(false);
    expect(canManageMemberRoleAssignment(true, true, owner, 1)).toBe(false);
    expect(canManageMemberRoleAssignment(true, true, owner, 2)).toBe(true);
    expect(canManageMemberRoleAssignment(false, true, members[0], 0)).toBe(false);
    expect(canManageMemberRoleAssignment(true, false, members[0], 0)).toBe(true);
  });

  it('only exposes owner as an assignable role when owner management is allowed', () => {
    expect(getAssignableTenantRoles(false)).not.toContain('owner');
    expect(getAssignableTenantRoles(true)).toContain('owner');
  });

  it('derives pending and expired invite setup states when backend provides onboarding data', () => {
    const now = new Date('2026-05-14T08:00:00.000Z');

    expect(getMemberInviteState({
      userId: 4,
      role: 'student',
      onboarding: { setupRequired: true, expiresAt: '2026-05-15T08:00:00.000Z', emailSent: true },
    }, now)).toEqual({
      status: 'pending',
      setupLink: undefined,
      expiresAt: '2026-05-15T08:00:00.000Z',
      emailSent: true,
    });

    expect(getMemberInviteState({
      userId: 5,
      role: 'instructor',
      invitation: { status: 'pending', expiresAt: '2026-05-13T08:00:00.000Z', setupLink: 'https://setup.test' },
    }, now)).toEqual({
      status: 'expired',
      setupLink: 'https://setup.test',
      expiresAt: '2026-05-13T08:00:00.000Z',
      emailSent: undefined,
    });

    expect(getMemberInviteState({ userId: 6, role: 'student' }, now)).toBeNull();
  });
});
