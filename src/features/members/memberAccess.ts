import type { CompanyMember } from '../../types/domain';

export const manageableTenantRoles = ['company_admin', 'instructor', 'assistant', 'student'];
export const ownerAssignableTenantRoles = ['owner', ...manageableTenantRoles];

export type MemberInviteState = {
  status: 'pending' | 'expired';
  setupLink?: string;
  expiresAt?: string;
  emailSent?: boolean;
};

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

export function canManageMemberRoleAssignment(
  canManageMembers: boolean,
  canManageOwners: boolean,
  member: CompanyMember,
  ownerCount: number,
) {
  if (!canManageMembers) return false;
  if (member.role !== 'owner') return true;
  return canManageOwners && ownerCount > 1;
}

export function getAssignableTenantRoles(canManageOwners: boolean) {
  return canManageOwners ? ownerAssignableTenantRoles : manageableTenantRoles;
}

export function getMemberInviteState(member: CompanyMember, now = new Date()): MemberInviteState | null {
  const onboarding = member.onboarding;
  const invitation = member.invitation;
  const rawStatus = String(invitation?.status ?? onboarding?.status ?? '').trim().toLowerCase();
  const setupRequired = onboarding?.setupRequired === true
    || onboarding?.setupCompleted === false
    || ['pending', 'invited', 'expired'].includes(rawStatus);

  if (!setupRequired) return null;

  const expiresAt = invitation?.expiresAt ?? onboarding?.expiresAt ?? undefined;
  const expiresTime = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const expired = rawStatus === 'expired' || (Number.isFinite(expiresTime) && expiresTime < now.getTime());

  return {
    status: expired ? 'expired' : 'pending',
    setupLink: invitation?.setupLink ?? onboarding?.setupLink ?? undefined,
    expiresAt,
    emailSent: invitation?.emailSent ?? onboarding?.emailSent ?? undefined,
  };
}
