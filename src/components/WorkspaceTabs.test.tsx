import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkspaceTabs } from './WorkspaceTabs';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
] as const;

afterEach(() => {
  cleanup();
});

describe('WorkspaceTabs', () => {
  it('marks the active tab for assistive technology', () => {
    render(
      <WorkspaceTabs
        tabs={tabs}
        activeTab="activity"
        onChange={vi.fn()}
        ariaLabel="Example tabs"
        className="example-tabs"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('tabIndex', '-1');
  });

  it('supports arrow, Home, and End keyboard navigation', () => {
    const onChange = vi.fn();
    render(
      <WorkspaceTabs
        tabs={tabs}
        activeTab="activity"
        onChange={onChange}
        ariaLabel="Example tabs"
        className="example-tabs"
      />,
    );

    const tablist = screen.getByRole('tablist', { name: 'Example tabs' });

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('settings');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('overview');

    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('overview');

    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('settings');
  });
});
