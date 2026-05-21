import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { MembersPage } from './MembersPage';

const api = vi.hoisted(() => ({
  addTenantMember: vi.fn(),
  inviteTenantMember: vi.fn(),
  listTenantMembers: vi.fn(),
  removeTenantMember: vi.fn(),
  resendTenantInvitation: vi.fn(),
  searchUsers: vi.fn(),
  setTenantMemberRole: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { id: 7, role: 'company_admin', email: 'admin@test.dev', fullName: 'Admin User' },
}));

const tenantState = vi.hoisted(() => ({
  tenant: {
    id: 42,
    name: 'EduPro',
    role: 'company_admin',
    permissions: {
      canManageMembers: true,
    },
  },
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: toast,
}));

vi.mock('../../services/api', () => api);

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: authState.user,
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: tenantState.tenant,
  }),
}));

describe('MembersPage member setup links', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    api.listTenantMembers.mockResolvedValue([]);
    api.searchUsers.mockResolvedValue([
      { id: 15, email: 'teacher@example.test', fullName: 'Teacher User' },
    ]);
    api.addTenantMember.mockResolvedValue({
      userId: 15,
      companyId: 42,
      role: 'instructor',
      onboarding: {
        setupLink: 'https://setup.example.test/token',
        expiresAt: '2026-05-22T08:00:00.000Z',
        emailSent: false,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the setup link after adding an existing user who still needs account setup', async () => {
    render(<MembersPage />);

    await screen.findByText('No members');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add existing' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Name or email'), { target: { value: 'teacher' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Teacher User (teacher@example.test)');
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => expect(api.addTenantMember).toHaveBeenCalledWith(42, {
      userId: 15,
      role: 'student',
    }));
    expect(await screen.findByRole('heading', { name: 'Setup link ready' })).toBeInTheDocument();
    expect(screen.getByText('https://setup.example.test/token')).toBeInTheDocument();
  });
});
