import type { CompanyMember } from '../../types/domain';

export const manageableTenantRoles = ['company_admin', 'instructor', 'assistant', 'student'];

export function memberName(member: CompanyMember) {
  return member.user?.fullName || member.fullName || `User ${member.userId}`;
}

export function memberEmail(member: CompanyMember) {
  return member.user?.email || member.email || '';
}

export function getRolesByUser(members: CompanyMember[]) {
  return members.reduce<Record<number, string[]>>((acc, member) => {
    acc[member.userId] = [...(acc[member.userId] ?? []), String(member.role)];
    return acc;
  }, {});
}

export function hasDuplicateTenantRole(rolesByUser: Record<number, string[]>, userId: number | undefined, role: string) {
  if (!userId) return false;
  return (rolesByUser[userId] ?? []).includes(role);
}

export function canChangeMemberRole(
  rolesByUser: Record<number, string[]>,
  member: CompanyMember,
  nextRole: string,
) {
  if (nextRole === member.role) return false;
  return !hasDuplicateTenantRole(rolesByUser, member.userId, nextRole);
}
