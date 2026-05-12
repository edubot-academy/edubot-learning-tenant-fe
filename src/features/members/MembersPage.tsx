import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
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
const roleDescriptions: Record<string, string> = {
  owner: 'Platform-managed tenant owner with highest access.',
  company_admin: 'Can manage tenant operations, members, and settings.',
  instructor: 'Can run sessions, attendance, homework, and certificates.',
  assistant: 'Can support daily operations and learner administration.',
  student: 'Learner access to courses, sessions, homework, and certificates.',
};

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
      .catch(() => toast.error('Could not load members'))
      .finally(() => setLoading(false));
    // reloadMembers is intentionally scoped to activeTenantId for this initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

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
      { label: 'Members', value: members.length, hint: 'All tenant assignments' },
      { label: 'Admins', value: countRole('owner') + countRole('company_admin'), hint: 'Owner and tenant admin roles' },
      { label: 'Instructors', value: countRole('instructor'), hint: 'Teaching users' },
      { label: 'Students', value: countRole('student'), hint: 'Learner users' },
    ];
  }, [members]);

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
      toast.error('Could not search users');
    } finally {
      setWorking(false);
    }
  };

  const submitAddExisting = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) return;
    if (!activeTenantId || !selectedUserId) {
      toast.error('Select a user first');
      return;
    }
    if (selectedUserHasRole) {
      toast.error('This user already has that tenant role');
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
      toast.success('Member added');
    } catch {
      toast.error('Could not add member');
    } finally {
      setWorking(false);
    }
  };

  const submitInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) return;
    if (!activeTenantId) return;
    if (!inviteForm.email.trim() || !inviteForm.fullName.trim()) {
      toast.error('Email and full name are required');
      return;
    }
    if (inviteExistingMember) {
      toast.error('This email already has that tenant role');
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
      toast.success('Member invited');
    } catch {
      toast.error('Could not invite member');
    } finally {
      setWorking(false);
    }
  };

  const copyInviteLink = async () => {
    const link = inviteResult?.onboarding?.setupLink;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy invite link');
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
      toast.success(result?.onboarding?.emailSent ? 'Invite resent' : 'Invite link regenerated');
    } catch {
      toast.error('Could not resend invite');
    } finally {
      setWorking(false);
    }
  };

  const changeMemberRole = async (member: CompanyMember, nextRole: string) => {
    if (!canManageMembers) return;
    if (!activeTenantId || nextRole === member.role) return;
    if (!canChangeMemberRole(rolesByUser, member, nextRole)) {
      toast.error('This user already has that tenant role');
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
      toast.success('Role updated');
    } catch {
      toast.error('Could not update role');
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
      toast.success('Member role removed');
      setMemberPendingRemoval(null);
    } catch {
      toast.error('Could not remove member role');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <LoadingState label="Loading members" />;

  return (
    <>
      <PageHeader
        title="Members"
        eyebrow={activeTenant?.name}
        actions={canManageMembers ? (
          <>
            <button type="button" className="secondary-button" onClick={() => setMemberModal('existing')} disabled={working}>Add existing</button>
            <button type="button" onClick={() => setMemberModal('invite')} disabled={working}>Invite member</button>
          </>
        ) : undefined}
      />
      <StatGrid items={stats} />
      <section className="member-access-summary">
        <article>
          <FiShield />
          <div>
            <strong>Tenant access</strong>
            <span>Roles here apply only inside this tenant workspace.</span>
          </div>
        </article>
        <article>
          <FiUserCheck />
          <div>
            <strong>Platform-managed owners</strong>
            <span>Owner role changes stay in platform management.</span>
          </div>
        </article>
        <article>
          <FiUsers />
          <div>
            <strong>Operational roles</strong>
            <span>Tenant admins, instructors, assistants, and students can be managed here.</span>
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
            {item === 'all' ? 'All' : readable(item)}
            <strong>{roleCounts[item] ?? 0}</strong>
          </button>
        ))}
      </div>
      <div className="filters-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, or role"
        />
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          {tenantRoles.map((option) => (
            <option key={option} value={option}>{option === 'all' ? 'All roles' : readable(option)}</option>
          ))}
        </select>
      </div>
      {!members.length ? (
        <EmptyState
          title="No members"
          detail={canManageMembers
            ? 'Invite a user or add an existing platform user to grant tenant access.'
            : 'No tenant access assignments are available for this workspace.'}
        />
      ) : !filteredMembers.length ? (
        <EmptyState title="No matching members" detail="Adjust the search or role filter." />
      ) : (
        <div className="workspace-grid">
          <section className="content-section">
            <h2>Tenant roster</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={`${member.userId}-${member.role}`}>
                      <td data-label="Name">
                        <strong>{memberName(member)}</strong>
                        <small>User {member.userId}</small>
                        <div className="member-role-stack">
                          {(rolesByUser[member.userId] ?? []).map((item) => (
                            <span key={item}>{readable(item)}</span>
                          ))}
                        </div>
                      </td>
                      <td data-label="Email">{memberEmail(member)}</td>
                      <td data-label="Role">
                        {isOwnerRole(member) || !canManageMembers ? (
                          <span className={`status-badge role-${member.role}`}>{readable(member.role)}</span>
                        ) : (
                          <label className="member-role-select-label">
                            <span className={`status-badge role-${member.role}`}>{readable(member.role)}</span>
                            <select
                              value={member.role}
                              onChange={(event) => void changeMemberRole(member, event.target.value)}
                              disabled={working}
                            >
                              {manageableTenantRoles.map((option) => (
                                <option key={option} value={option} disabled={option !== member.role && hasDuplicateTenantRole(rolesByUser, member.userId, option)}>
                                  {readable(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </td>
                      <td data-label="Added">{formatDate(member.createdAt)}</td>
                      <td data-label="Actions">
                        {isOwnerRole(member) || !canManageMembers ? (
                          <span className="muted-text">{isOwnerRole(member) ? 'Platform managed' : 'Read only'}</span>
                        ) : (
                          <div className="member-row-actions">
                            <button type="button" className="secondary-button" disabled={working} onClick={() => void resendInvite(member)}>
                              Resend invite
                            </button>
                            <button type="button" className="secondary-button" disabled={working} onClick={() => setMemberPendingRemoval(member)}>
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="member-card-list" aria-label="Tenant roster cards">
              {filteredMembers.map((member) => (
                <article className="member-card" key={`card-${member.userId}-${member.role}`}>
                  <div className="member-card-header">
                    <div>
                      <strong>{memberName(member)}</strong>
                      <span>{memberEmail(member)}</span>
                    </div>
                    <span className={`status-badge role-${member.role}`}>{readable(member.role)}</span>
                  </div>
                  <dl className="member-card-meta">
                    <div>
                      <dt>User</dt>
                      <dd>{member.userId}</dd>
                    </div>
                    <div>
                      <dt>Added</dt>
                      <dd>{formatDate(member.createdAt)}</dd>
                    </div>
                  </dl>
                  {(rolesByUser[member.userId] ?? []).length > 1 ? (
                    <div className="member-role-stack">
                      {(rolesByUser[member.userId] ?? []).map((item) => (
                        <span key={item}>{readable(item)}</span>
                      ))}
                    </div>
                  ) : null}
                  {isOwnerRole(member) || !canManageMembers ? (
                    <span className="muted-text">{isOwnerRole(member) ? 'Platform managed' : 'Read only'}</span>
                  ) : (
                    <div className="member-card-actions">
                      <label>
                        Role
                        <select
                          value={member.role}
                          onChange={(event) => void changeMemberRole(member, event.target.value)}
                          disabled={working}
                        >
                          {manageableTenantRoles.map((option) => (
                            <option key={option} value={option} disabled={option !== member.role && hasDuplicateTenantRole(rolesByUser, member.userId, option)}>
                              {readable(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="member-row-actions">
                        <button type="button" className="secondary-button" disabled={working} onClick={() => void resendInvite(member)}>
                          Resend invite
                        </button>
                        <button type="button" className="secondary-button" disabled={working} onClick={() => setMemberPendingRemoval(member)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <aside className="settings-panel">
            <h2>Role groups</h2>
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
                      <strong>{readable(item)}</strong>
                      <span>{roleDescriptions[item]}</span>
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
              <span>Existing user</span>
              <h2 id="add-existing-member-title">Add existing user</h2>
              <p>Search platform users and assign a tenant role.</p>
            </div>
            <div className="student-search-row">
              <label>
                Search
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Name or email" autoFocus />
              </label>
              <button type="button" className="secondary-button" disabled={working} onClick={() => void runUserSearch()}>
                Search
              </button>
            </div>
            <div className="two-col">
              <label>
                User
                <select value={selectedUserId ?? ''} onChange={(event) => setSelectedUserId(Number(event.target.value) || undefined)} disabled={!userResults.length}>
                  <option value="">Select user</option>
                  {userResults.map((user) => (
                    <option key={user.id} value={user.id}>{user.fullName || user.email} ({user.email})</option>
                  ))}
                </select>
              </label>
              <label>
                Role
                <select value={addRole} onChange={(event) => setAddRole(event.target.value)}>
                  {manageableTenantRoles.map((option) => <option key={option} value={option}>{readable(option)}</option>)}
                </select>
                <span className="field-help">{roleDescriptions[addRole]}</span>
              </label>
            </div>
            {userSearchRan && userSearch.trim() && !working && !userResults.length ? (
              <p className="panel-note">No platform users matched this search.</p>
            ) : null}
            {selectedUserExistingRoles.length ? (
              <p className="panel-note">
                Existing tenant roles for this user: {selectedUserExistingRoles.map(readable).join(', ')}.
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
                Cancel
              </button>
              <button type="submit" disabled={!selectedUserId || selectedUserHasRole || working}>
                {working ? 'Adding...' : selectedUserHasRole ? 'Role already assigned' : 'Add member'}
              </button>
            </div>
        </FormModal>
      ) : null}
      {canManageMembers && memberModal === 'invite' ? (
        <FormModal labelledBy="invite-member-title" onClose={() => { setMemberModal(null); setInviteResult(null); }} onSubmit={submitInvite}>
            <div className="modal-header-block">
              <span>Invite</span>
              <h2 id="invite-member-title">Invite or create user</h2>
              <p>Create tenant access for a new user profile.</p>
            </div>
            <div className="two-col">
              <label>
                Full name
                <input
                  value={inviteForm.fullName}
                  onChange={(event) => setInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                  autoComplete="name"
                  autoFocus
                  required
                />
              </label>
              <label>
                Email
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
                Role
                <select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}>
                  {manageableTenantRoles.map((option) => <option key={option} value={option}>{readable(option)}</option>)}
                </select>
                <span className="field-help">{roleDescriptions[inviteForm.role]}</span>
              </label>
              <label className="checkbox-row member-send-email">
                <input type="checkbox" checked={inviteForm.sendEmail} onChange={(event) => setInviteForm((current) => ({ ...current, sendEmail: event.target.checked }))} />
                Send setup email
              </label>
            </div>
            {inviteResult?.onboarding?.setupLink ? (
              <div className="invite-link-panel">
                <strong>Setup link</strong>
                <span>{inviteResult.onboarding.setupLink}</span>
                <button type="button" className="secondary-button" onClick={() => void copyInviteLink()}>
                  Copy link
                </button>
                <small>
                  {inviteResult.onboarding.emailSent ? 'Email sent. ' : ''}
                  Expires {inviteResult.onboarding.expiresAt ? formatDate(inviteResult.onboarding.expiresAt) : 'soon'}.
                </small>
              </div>
            ) : null}
            {inviteExistingMember ? (
              <p className="panel-note">This email already has the {readable(inviteForm.role)} role in this tenant.</p>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => { setMemberModal(null); setInviteResult(null); }} disabled={working}>Cancel</button>
              <button type="submit" disabled={working || Boolean(inviteExistingMember)}>{working ? 'Inviting...' : inviteExistingMember ? 'Role already assigned' : 'Invite member'}</button>
            </div>
        </FormModal>
      ) : null}
      {canManageMembers && inviteLinkModalOpen ? (
        <Modal labelledBy="invite-link-title" onClose={() => setInviteLinkModalOpen(false)}>
            <div className="modal-header-block">
              <span>Invite link</span>
              <h2 id="invite-link-title">Setup link regenerated</h2>
              <p>Copy and share this link if the user did not receive the setup email.</p>
            </div>
            {inviteResult?.onboarding?.setupLink ? (
              <div className="invite-link-panel">
                <strong>Setup link</strong>
                <span>{inviteResult.onboarding.setupLink}</span>
                <button type="button" className="secondary-button" onClick={() => void copyInviteLink()}>
                  Copy link
                </button>
                <small>
                  {inviteResult.onboarding.emailSent ? 'Email sent. ' : ''}
                  Expires {inviteResult.onboarding.expiresAt ? formatDate(inviteResult.onboarding.expiresAt) : 'soon'}.
                </small>
              </div>
            ) : (
              <p className="panel-note">No setup link is available for this member. The account may already be active.</p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setInviteLinkModalOpen(false)}>Close</button>
            </div>
        </Modal>
      ) : null}
      {canManageMembers && memberPendingRemoval ? (
        <Modal labelledBy="remove-member-title" onClose={() => setMemberPendingRemoval(null)}>
            <div className="modal-header-block">
              <span>Remove role</span>
              <h2 id="remove-member-title">Remove tenant access</h2>
              <p>{memberName(memberPendingRemoval)} · {readable(memberPendingRemoval.role)}</p>
            </div>
            <p className="panel-note">This removes only this tenant role. It does not delete the platform user account.</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setMemberPendingRemoval(null)} disabled={working}>Cancel</button>
              <button type="button" className="danger-button" onClick={() => void removeMemberRole(memberPendingRemoval)} disabled={working}>
                {working ? 'Removing...' : 'Remove access'}
              </button>
            </div>
        </Modal>
      ) : null}
    </>
  );
}
