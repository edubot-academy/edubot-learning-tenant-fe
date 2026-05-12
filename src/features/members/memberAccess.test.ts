import { describe, expect, it } from 'vitest';
import type { CompanyMember } from '../../types/domain';
import { canChangeMemberRole, getRolesByUser, hasDuplicateTenantRole, memberEmail, memberName } from './memberAccess';

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
});
