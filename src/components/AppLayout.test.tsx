import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n/config';
import { AppLayout } from './AppLayout';

const signOut = vi.fn();

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'instructor@example.com', role: 'instructor', fullName: 'Tenant Instructor' },
    signOut,
  }),
}));

vi.mock('../features/tenant/TenantProvider', () => ({
  useTenant: () => ({
    tenants: [{ id: 10, name: 'Tenant', role: 'instructor', featureFlags: {} }],
    activeTenant: { id: 10, name: 'Tenant', role: 'instructor', featureFlags: {} },
    hostnameLocked: true,
    setActiveTenantId: vi.fn(),
  }),
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
    signOut.mockClear();
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
