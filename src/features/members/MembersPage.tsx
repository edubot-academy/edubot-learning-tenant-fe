import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FiShield, FiUserCheck, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import {
  addTenantMember,
  inviteTenantMember,
  listTenantMembers,
  removeTenantMember,
  resendTenantInvitation,
  searchUsers,
  setTenantMemberRole,
} from '../../services/api';
import type { CompanyMember, UserSummary } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate, readable } from '../../lib/format';
import { useAuth } from '../auth/AuthProvider';
import { canManageTenantMembers } from '../tenant/tenantRoles';
import {
  canChangeMemberRole,
  getRolesByUser,
  hasDuplicateTenantRole,
  manageableTenantRoles,
  memberEmail,
  memberName,
} from './memberAccess';

const tenantRoles = ['all', 'owner', 'company_admin', 'instructor', 'assistant', 'student'];

const emptyInviteForm = {
  email: '',
  fullName: '',
  role: 'student',
  sendEmail: false,
};

type InviteResult = {
  onboarding?: {
    setupLink?: string;
    expiresAt?: string;
    emailSent?: boolean;
  } | null;
} | null;

function isOwnerRole(member: CompanyMember) {
  return member.role === 'owner';
}

export function MembersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const canManageMembers = canManageTenantMembers(user, activeTenant);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserSummary[]>([]);
  const [userSearchRan, setUserSearchRan] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>();
  const [addRole, setAddRole] = useState('student');
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteResult, setInviteResult] = useState<InviteResult>(null);
  const [inviteLinkModalOpen, setInviteLinkModalOpen] = useState(false);
  const [memberModal, setMemberModal] = useState<'existing' | 'invite' | null>(null);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<CompanyMember | null>(null);

  const reloadMembers = async () => {
    if (!activeTenantId) return;
    const rows = await listTenantMembers(activeTenantId);
    setMembers(rows);
  };

  useEffect(() => {
    if (!activeTenantId) return;
    setLoading(true);
    reloadMembers()
      .catch(() => toast.error(t('members.loadFailed')))
      .finally(() => setLoading(false));
    // reloadMembers is intentionally scoped to activeTenantId for this initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, t]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return members.filter((member) => {
      const matchesRole = role === 'all' || member.role === role;
      const matchesQuery = !normalizedQuery
        || memberName(member).toLowerCase().includes(normalizedQuery)
        || memberEmail(member).toLowerCase().includes(normalizedQuery)
        || String(member.role).toLowerCase().includes(normalizedQuery);
      return matchesRole && matchesQuery;
    });
  }, [members, query, role]);

  const roleCounts = useMemo(() => (
    tenantRoles.reduce<Record<string, number>>((acc, item) => {
      acc[item] = item === 'all' ? members.length : members.filter((member) => member.role === item).length;
      return acc;
    }, {})
  ), [members]);

  const rolesByUser = useMemo(() => getRolesByUser(members), [members]);

  const stats = useMemo(() => {
    const countRole = (targetRole: string) => members.filter((member) => member.role === targetRole).length;
    return [
      { label: t('members.members'), value: members.length, hint: t('members.allAssignments') },
      { label: t('members.admins'), value: countRole('owner') + countRole('company_admin'), hint: t('members.adminHint') },
      { label: t('members.instructors'), value: countRole('instructor'), hint: t('members.instructorHint') },
      { label: t('members.students'), value: countRole('student'), hint: t('members.studentHint') },
    ];
  }, [members, t]);
  const roleLabel = (value: string) => {
    const labels: Record<string, string> = {
      all: t('members.all'),
      assistant: t('members.roleAssistant'),
      company_admin: t('members.roleCompanyAdmin'),
      instructor: t('members.roleInstructor'),
      owner: t('members.roleOwner'),
      student: t('members.roleStudent'),
    };
    return labels[value] ?? readable(value);
  };
  const roleDescription = (value: string) => {
    const descriptions: Record<string, string> = {
      assistant: t('members.roleAssistantDetail'),
      company_admin: t('members.roleCompanyAdminDetail'),
      instructor: t('members.roleInstructorDetail'),
      owner: t('members.roleOwnerDetail'),
      student: t('members.roleStudentDetail'),
    };
    return descriptions[value] ?? '';
  };
  const memberNameDisplay = (member: CompanyMember) => memberName(member).replace(/^User (\d+)$/, (_, id) => t('courses.userFallback', { id }));
  const memberEmailDisplay = (member: CompanyMember) => {
    const email = memberEmail(member);
    return email || t('states.notSet');
  };

  const selectedUserExistingRoles = selectedUserId ? rolesByUser[selectedUserId] ?? [] : [];
  const selectedUserHasRole = hasDuplicateTenantRole(rolesByUser, selectedUserId, addRole);
  const inviteExistingMember = members.find((member) => (
    memberEmail(member).toLowerCase() === inviteForm.email.trim().toLowerCase()
    && member.role === inviteForm.role
  ));

  const runUserSearch = async () => {
    if (!canManageMembers) return;
    setWorking(true);
    setUserSearchRan(true);
    try {
      const results = await searchUsers({ search: userSearch, limit: 12 });
      setUserResults(results);
      setSelectedUserId(results[0]?.id);
    } catch {
      toast.error(t('members.searchFailed'));
    } finally {
      setWorking(false);
    }
  };

  const submitAddExisting = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) return;
    if (!activeTenantId || !selectedUserId) {
      toast.error(t('members.selectUserFirst'));
      return;
    }
    if (selectedUserHasRole) {
      toast.error(t('members.duplicateRole'));
      return;
    }
    setWorking(true);
    try {
      await addTenantMember(activeTenantId, { userId: selectedUserId, role: addRole });
      await reloadMembers();
      setMemberModal(null);
      setUserSearch('');
      setUserResults([]);
      setUserSearchRan(false);
      setSelectedUserId(undefined);
      toast.success(t('members.added'));
    } catch {
      toast.error(t('members.addFailed'));
    } finally {
      setWorking(false);
    }
  };

  const submitInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) return;
    if (!activeTenantId) return;
    if (!inviteForm.email.trim() || !inviteForm.fullName.trim()) {
      toast.error(t('members.nameEmailRequired'));
      return;
    }
    if (inviteExistingMember) {
      toast.error(t('members.emailDuplicateRole'));
      return;
    }
    setWorking(true);
    setInviteResult(null);
    try {
      const result = await inviteTenantMember(activeTenantId, {
        email: inviteForm.email.trim(),
        fullName: inviteForm.fullName.trim(),
        role: inviteForm.role,
        sendEmail: inviteForm.sendEmail,
      });
      setInviteResult(result);
      await reloadMembers();
      setInviteForm(emptyInviteForm);
      toast.success(t('members.invited'));
    } catch {
      toast.error(t('members.inviteFailed'));
    } finally {
      setWorking(false);
    }
  };

  const copyInviteLink = async () => {
    const link = inviteResult?.onboarding?.setupLink;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('members.inviteLinkCopied'));
    } catch {
      toast.error(t('members.inviteLinkCopyFailed'));
    }
  };

  const resendInvite = async (member: CompanyMember) => {
    if (!canManageMembers) return;
    if (!activeTenantId) return;
    setWorking(true);
    setInviteResult(null);
    try {
      const result = await resendTenantInvitation(activeTenantId, member.userId, { sendEmail: true });
      setInviteResult(result);
      setInviteLinkModalOpen(true);
      toast.success(result?.onboarding?.emailSent ? t('members.inviteResent') : t('members.inviteLinkRegenerated'));
    } catch {
      toast.error(t('members.inviteResendFailed'));
    } finally {
      setWorking(false);
    }
  };

  const changeMemberRole = async (member: CompanyMember, nextRole: string) => {
    if (!canManageMembers) return;
    if (!activeTenantId || nextRole === member.role) return;
    if (!canChangeMemberRole(rolesByUser, member, nextRole)) {
      toast.error(t('members.duplicateRole'));
      return;
    }
    setWorking(true);
    try {
      await setTenantMemberRole(activeTenantId, member.userId, {
        role: nextRole,
        mode: 'replace',
        fromRole: member.role,
      });
      await reloadMembers();
      toast.success(t('members.roleUpdated'));
    } catch {
      toast.error(t('members.roleUpdateFailed'));
    } finally {
      setWorking(false);
    }
  };

  const removeMemberRole = async (member: CompanyMember) => {
    if (!canManageMembers) return;
    if (!activeTenantId) return;
    setWorking(true);
    try {
      await removeTenantMember(activeTenantId, member.userId, member.role);
      await reloadMembers();
      toast.success(t('members.roleRemoved'));
      setMemberPendingRemoval(null);
    } catch {
      toast.error(t('members.roleRemoveFailed'));
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <LoadingState label={t('members.loading')} />;

  return (
    <>
      <PageHeader
        title={t('members.members')}
        eyebrow={activeTenant?.name}
        actions={canManageMembers ? (
          <>
            <button type="button" className="secondary-button" onClick={() => setMemberModal('existing')} disabled={working}>{t('members.addExisting')}</button>
            <button type="button" onClick={() => setMemberModal('invite')} disabled={working}>{t('members.inviteMember')}</button>
          </>
        ) : undefined}
      />
      <StatGrid items={stats} />
      <section className="member-access-summary">
        <article>
          <FiShield />
          <div>
            <strong>{t('members.tenantAccess')}</strong>
            <span>{t('members.tenantAccessDetail')}</span>
          </div>
        </article>
        <article>
          <FiUserCheck />
          <div>
            <strong>{t('members.platformOwners')}</strong>
            <span>{t('members.platformOwnersDetail')}</span>
          </div>
        </article>
        <article>
          <FiUsers />
          <div>
            <strong>{t('members.operationalRoles')}</strong>
            <span>{t('members.operationalRolesDetail')}</span>
          </div>
        </article>
      </section>
      <div className="member-role-chips">
        {tenantRoles.map((item) => (
          <button
            key={item}
            type="button"
            className={role === item ? 'active' : ''}
            onClick={() => setRole(item)}
          >
            {roleLabel(item)}
            <strong>{roleCounts[item] ?? 0}</strong>
          </button>
        ))}
      </div>
      <div className="filters-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('members.searchPlaceholder')}
        />
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          {tenantRoles.map((option) => (
            <option key={option} value={option}>{option === 'all' ? t('members.allRoles') : roleLabel(option)}</option>
          ))}
        </select>
      </div>
      {!members.length ? (
        <EmptyState
          title={t('members.emptyTitle')}
          detail={canManageMembers
            ? t('members.emptyManageDetail')
            : t('members.emptyReadOnlyDetail')}
        />
      ) : !filteredMembers.length ? (
        <EmptyState title={t('members.noMatchesTitle')} detail={t('members.noMatchesDetail')} />
      ) : (
        <div className="workspace-grid">
          <section className="content-section">
            <h2>{t('members.tenantRoster')}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('groups.name')}</th>
                    <th>{t('groups.email')}</th>
                    <th>{t('members.role')}</th>
                    <th>{t('members.addedColumn')}</th>
                    <th>{t('members.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={`${member.userId}-${member.role}`}>
                      <td data-label={t('groups.name')}>
                        <strong>{memberNameDisplay(member)}</strong>
                        <small>{t('members.userId', { id: member.userId })}</small>
                        <div className="member-role-stack">
                          {(rolesByUser[member.userId] ?? []).map((item) => (
                            <span key={item}>{roleLabel(item)}</span>
                          ))}
                        </div>
                      </td>
                      <td data-label={t('groups.email')}>{memberEmailDisplay(member)}</td>
                      <td data-label={t('members.role')}>
                        {isOwnerRole(member) || !canManageMembers ? (
                          <span className={`status-badge role-${member.role}`}>{roleLabel(member.role)}</span>
                        ) : (
                          <label className="member-role-select-label">
                            <span className={`status-badge role-${member.role}`}>{roleLabel(member.role)}</span>
                            <select
                              value={member.role}
                              onChange={(event) => void changeMemberRole(member, event.target.value)}
                              disabled={working}
                            >
                              {manageableTenantRoles.map((option) => (
                                <option key={option} value={option} disabled={option !== member.role && hasDuplicateTenantRole(rolesByUser, member.userId, option)}>
                                  {roleLabel(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </td>
                      <td data-label={t('members.addedColumn')}>{formatDate(member.createdAt)}</td>
                      <td data-label={t('members.actions')}>
                        {isOwnerRole(member) || !canManageMembers ? (
                          <span className="muted-text">{isOwnerRole(member) ? t('members.platformManaged') : t('members.readOnly')}</span>
                        ) : (
                          <div className="member-row-actions">
                            <button type="button" className="secondary-button" disabled={working} onClick={() => void resendInvite(member)}>
                              {t('members.resendInvite')}
                            </button>
                            <button type="button" className="secondary-button" disabled={working} onClick={() => setMemberPendingRemoval(member)}>
                              {t('groups.remove')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="member-card-list" aria-label={t('members.tenantRosterCards')}>
              {filteredMembers.map((member) => (
                <article className="member-card" key={`card-${member.userId}-${member.role}`}>
                  <div className="member-card-header">
                    <div>
                      <strong>{memberNameDisplay(member)}</strong>
                      <span>{memberEmailDisplay(member)}</span>
                    </div>
                    <span className={`status-badge role-${member.role}`}>{roleLabel(member.role)}</span>
                  </div>
                  <dl className="member-card-meta">
                    <div>
                      <dt>{t('members.user')}</dt>
                      <dd>{member.userId}</dd>
                    </div>
                    <div>
                      <dt>{t('members.addedColumn')}</dt>
                      <dd>{formatDate(member.createdAt)}</dd>
                    </div>
                  </dl>
                  {(rolesByUser[member.userId] ?? []).length > 1 ? (
                    <div className="member-role-stack">
                      {(rolesByUser[member.userId] ?? []).map((item) => (
                        <span key={item}>{roleLabel(item)}</span>
                      ))}
                    </div>
                  ) : null}
                  {isOwnerRole(member) || !canManageMembers ? (
                    <span className="muted-text">{isOwnerRole(member) ? t('members.platformManaged') : t('members.readOnly')}</span>
                  ) : (
                    <div className="member-card-actions">
                      <label>
                        {t('members.role')}
                        <select
                          value={member.role}
                          onChange={(event) => void changeMemberRole(member, event.target.value)}
                          disabled={working}
                        >
                          {manageableTenantRoles.map((option) => (
                            <option key={option} value={option} disabled={option !== member.role && hasDuplicateTenantRole(rolesByUser, member.userId, option)}>
                              {roleLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="member-row-actions">
                        <button type="button" className="secondary-button" disabled={working} onClick={() => void resendInvite(member)}>
                          {t('members.resendInvite')}
                        </button>
                        <button type="button" className="secondary-button" disabled={working} onClick={() => setMemberPendingRemoval(member)}>
                          {t('groups.remove')}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <aside className="settings-panel">
            <h2>{t('members.roleGroups')}</h2>
            <div className="stack-list">
              {tenantRoles.filter((item) => item !== 'all').map((item) => {
                const count = roleCounts[item] ?? 0;
                return (
                  <button
                    key={item}
                    type="button"
                    className={`stack-list-item role-filter-item ${role === item ? 'active' : ''}`}
                    onClick={() => setRole(item)}
                  >
                    <div>
                      <strong>{roleLabel(item)}</strong>
                      <span>{roleDescription(item)}</span>
                    </div>
                    <span className={`status-badge role-${item}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}
      {canManageMembers && memberModal === 'existing' ? (
        <FormModal
          labelledBy="add-existing-member-title"
          onClose={() => {
            setMemberModal(null);
            setUserSearchRan(false);
          }}
          onSubmit={submitAddExisting}
        >
            <div className="modal-header-block">
              <span>{t('members.existingUser')}</span>
              <h2 id="add-existing-member-title">{t('members.addExistingUser')}</h2>
              <p>{t('members.addExistingDetail')}</p>
            </div>
            <div className="student-search-row">
              <label>
                {t('groups.search')}
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={t('groups.nameOrEmail')} autoFocus />
              </label>
              <button type="button" className="secondary-button" disabled={working} onClick={() => void runUserSearch()}>
                {t('groups.search')}
              </button>
            </div>
            <div className="two-col">
              <label>
                {t('members.user')}
                <select value={selectedUserId ?? ''} onChange={(event) => setSelectedUserId(Number(event.target.value) || undefined)} disabled={!userResults.length}>
                  <option value="">{t('members.selectUser')}</option>
                  {userResults.map((user) => (
                    <option key={user.id} value={user.id}>{user.fullName || user.email} ({user.email})</option>
                  ))}
                </select>
              </label>
              <label>
                {t('members.role')}
                <select value={addRole} onChange={(event) => setAddRole(event.target.value)}>
                  {manageableTenantRoles.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
                </select>
                <span className="field-help">{roleDescription(addRole)}</span>
              </label>
            </div>
            {userSearchRan && userSearch.trim() && !working && !userResults.length ? (
              <p className="panel-note">{t('members.noPlatformUsers')}</p>
            ) : null}
            {selectedUserExistingRoles.length ? (
              <p className="panel-note">
                {t('members.existingRolesForUser', { roles: selectedUserExistingRoles.map(roleLabel).join(', ') })}
              </p>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setMemberModal(null);
                  setUserSearchRan(false);
                }}
                disabled={working}
              >
                {t('courses.cancel')}
              </button>
              <button type="submit" disabled={!selectedUserId || selectedUserHasRole || working}>
                {working ? t('members.adding') : selectedUserHasRole ? t('members.roleAlreadyAssigned') : t('members.addMember')}
              </button>
            </div>
        </FormModal>
      ) : null}
      {canManageMembers && memberModal === 'invite' ? (
        <FormModal labelledBy="invite-member-title" onClose={() => { setMemberModal(null); setInviteResult(null); }} onSubmit={submitInvite}>
            <div className="modal-header-block">
              <span>{t('members.invite')}</span>
              <h2 id="invite-member-title">{t('members.inviteOrCreateUser')}</h2>
              <p>{t('members.inviteDetail')}</p>
            </div>
            <div className="two-col">
              <label>
                {t('groups.fullName')}
                <input
                  value={inviteForm.fullName}
                  onChange={(event) => setInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                  autoComplete="name"
                  autoFocus
                  required
                />
              </label>
              <label>
                {t('groups.email')}
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  required
                />
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('members.role')}
                <select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}>
                  {manageableTenantRoles.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
                </select>
                <span className="field-help">{roleDescription(inviteForm.role)}</span>
              </label>
              <label className="checkbox-row member-send-email">
                <input type="checkbox" checked={inviteForm.sendEmail} onChange={(event) => setInviteForm((current) => ({ ...current, sendEmail: event.target.checked }))} />
                {t('groups.sendSetupEmail')}
              </label>
            </div>
            {inviteResult?.onboarding?.setupLink ? (
              <div className="invite-link-panel">
                <strong>{t('members.setupLink')}</strong>
                <span>{inviteResult.onboarding.setupLink}</span>
                <button type="button" className="secondary-button" onClick={() => void copyInviteLink()}>
                  {t('members.copyLink')}
                </button>
                <small>
                  {inviteResult.onboarding.emailSent ? `${t('members.emailSent')} ` : ''}
                  {t('members.expires', { date: inviteResult.onboarding.expiresAt ? formatDate(inviteResult.onboarding.expiresAt) : t('members.soon') })}
                </small>
              </div>
            ) : null}
            {inviteExistingMember ? (
              <p className="panel-note">{t('members.emailAlreadyHasRole', { role: roleLabel(inviteForm.role) })}</p>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => { setMemberModal(null); setInviteResult(null); }} disabled={working}>{t('courses.cancel')}</button>
              <button type="submit" disabled={working || Boolean(inviteExistingMember)}>{working ? t('members.inviting') : inviteExistingMember ? t('members.roleAlreadyAssigned') : t('members.inviteMember')}</button>
            </div>
        </FormModal>
      ) : null}
      {canManageMembers && inviteLinkModalOpen ? (
        <Modal labelledBy="invite-link-title" onClose={() => setInviteLinkModalOpen(false)}>
            <div className="modal-header-block">
              <span>{t('members.inviteLink')}</span>
              <h2 id="invite-link-title">{t('members.setupLinkRegenerated')}</h2>
              <p>{t('members.setupLinkRegeneratedDetail')}</p>
            </div>
            {inviteResult?.onboarding?.setupLink ? (
              <div className="invite-link-panel">
                <strong>{t('members.setupLink')}</strong>
                <span>{inviteResult.onboarding.setupLink}</span>
                <button type="button" className="secondary-button" onClick={() => void copyInviteLink()}>
                  {t('members.copyLink')}
                </button>
                <small>
                  {inviteResult.onboarding.emailSent ? `${t('members.emailSent')} ` : ''}
                  {t('members.expires', { date: inviteResult.onboarding.expiresAt ? formatDate(inviteResult.onboarding.expiresAt) : t('members.soon') })}
                </small>
              </div>
            ) : (
              <p className="panel-note">{t('members.noSetupLink')}</p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setInviteLinkModalOpen(false)}>{t('states.closeModal')}</button>
            </div>
        </Modal>
      ) : null}
      {canManageMembers && memberPendingRemoval ? (
        <Modal labelledBy="remove-member-title" onClose={() => setMemberPendingRemoval(null)}>
            <div className="modal-header-block">
              <span>{t('members.removeRole')}</span>
              <h2 id="remove-member-title">{t('members.removeTenantAccess')}</h2>
              <p>{memberNameDisplay(memberPendingRemoval)} · {roleLabel(memberPendingRemoval.role)}</p>
            </div>
            <p className="panel-note">{t('members.removeRoleDetail')}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setMemberPendingRemoval(null)} disabled={working}>{t('courses.cancel')}</button>
              <button type="button" className="danger-button" onClick={() => void removeMemberRole(memberPendingRemoval)} disabled={working}>
                {working ? t('groups.removing') : t('members.removeAccess')}
              </button>
            </div>
        </Modal>
      ) : null}
    </>
  );
}
