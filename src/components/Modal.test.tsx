import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/config';
import { Modal } from './Modal';

beforeEach(() => {
  i18n.changeLanguage('ky');
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('focuses dialog content and restores prior focus on close', async () => {
    const onClose = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = 'Open modal';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <Modal labelledBy="modal-title" onClose={onClose}>
        <h2 id="modal-title">Confirm action</h2>
        <button type="button">Confirm</button>
      </Modal>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /терезени жабуу/i })).toHaveFocus());
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Escape and backdrop click, but not dialog click', () => {
    const onClose = vi.fn();
    render(
      <Modal labelledBy="modal-title" onClose={onClose}>
        <h2 id="modal-title">Confirm action</h2>
        <button type="button">Confirm</button>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('cycles focus inside the dialog with Tab', async () => {
    render(
      <Modal labelledBy="modal-title" onClose={vi.fn()}>
        <h2 id="modal-title">Confirm action</h2>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Modal>,
    );

    const closeButton = await screen.findByRole('button', { name: /терезени жабуу/i });
    const secondButton = screen.getByRole('button', { name: 'Second' });

    secondButton.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(secondButton).toHaveFocus();
  });

  it('skips hidden focusable controls in the focus cycle', async () => {
    render(
      <Modal labelledBy="modal-title" onClose={vi.fn()}>
        <h2 id="modal-title">Upload attachment</h2>
        <input aria-label="Hidden upload" type="file" style={{ display: 'none' }} />
        <button type="button">Visible action</button>
      </Modal>,
    );

    const closeButton = await screen.findByRole('button', { name: /терезени жабуу/i });
    const visibleButton = screen.getByRole('button', { name: 'Visible action' });

    visibleButton.focus();
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(closeButton).toHaveFocus();
  });
});
