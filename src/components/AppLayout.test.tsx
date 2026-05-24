import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n/config';
import { AppLayout } from './AppLayout';
import { getStudentNotificationUnreadCount } from '../services/shellApi';

const signOut = vi.fn();
const layoutState = vi.hoisted(() => ({
  user: { id: 1, email: 'instructor@example.com', role: 'instructor', fullName: 'Tenant Instructor' },
  activeTenant: { id: 10, name: 'Tenant', role: 'instructor', featureFlags: {}, permissions: {} },
}));

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: layoutState.user,
    signOut,
  }),
}));

vi.mock('../features/tenant/TenantProvider', () => ({
  useTenant: () => ({
    tenants: [layoutState.activeTenant],
    activeTenant: layoutState.activeTenant,
    hostnameLocked: true,
    setActiveTenantId: vi.fn(),
  }),
}));

vi.mock('../services/shellApi', () => ({
  getStudentNotificationUnreadCount: vi.fn(() => Promise.resolve({ count: 0, hasUnread: false })),
  listStudentNotifications: vi.fn(() => Promise.resolve([])),
  markStudentNotificationRead: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('./LanguageMenu', () => ({
  LanguageMenu: () => <button type="button">Language</button>,
}));

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<AppLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

function getMoreButton() {
  const button = document.querySelector<HTMLButtonElement>('button[aria-controls="mobile-more-menu"]');
  if (!button) throw new Error('Mobile more button was not rendered');
  return button;
}

function getGroupsLink() {
  const link = document.querySelector<HTMLAnchorElement>('#mobile-more-menu a[href="/groups"]');
  if (!link) throw new Error('Groups link was not rendered in mobile more menu');
  return link;
}

describe('AppLayout mobile navigation', () => {
  beforeEach(() => {
    layoutState.user = { id: 1, email: 'instructor@example.com', role: 'instructor', fullName: 'Tenant Instructor' };
    layoutState.activeTenant = { id: 10, name: 'Tenant', role: 'instructor', featureFlags: {}, permissions: {} };
    signOut.mockClear();
    vi.mocked(getStudentNotificationUnreadCount).mockClear();
  });

  it('does not request student notifications for instructor shell users', () => {
    renderLayout();

    expect(getStudentNotificationUnreadCount).not.toHaveBeenCalled();
  });

  it('does not request student notifications when a stale student role has instructor permissions', () => {
    layoutState.user = { id: 1, email: 'teacher@example.com', role: 'student', fullName: 'Assigned Teacher' };
    layoutState.activeTenant = {
      id: 10,
      name: 'Tenant',
      role: 'student',
      featureFlags: {},
      permissions: { canTeachAssignedSessions: true },
    };

    renderLayout();

    expect(getStudentNotificationUnreadCount).not.toHaveBeenCalled();
  });

  it('closes the mobile more menu with Escape and outside pointer click', () => {
    renderLayout();

    const moreButton = getMoreButton();
    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    expect(getGroupsLink()).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.pointerDown(document.body);
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the mobile more menu after route navigation', () => {
    renderLayout();

    const moreButton = getMoreButton();
    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(getGroupsLink());

    expect(moreButton).toHaveAttribute('aria-expanded', 'false');
  });
});
