import { describe, expect, it } from 'vitest';
import { getPasswordSetupError } from './authPassword';

describe('auth password validation', () => {
  it('requires at least eight characters', () => {
    expect(getPasswordSetupError('short', 'short')).toBe('Password must be at least 8 characters.');
  });

  it('requires matching confirmation', () => {
    expect(getPasswordSetupError('Password123', 'Password124')).toBe('Passwords do not match.');
  });

  it('allows valid password setup input', () => {
    expect(getPasswordSetupError('Password123', 'Password123')).toBe('');
  });
});
