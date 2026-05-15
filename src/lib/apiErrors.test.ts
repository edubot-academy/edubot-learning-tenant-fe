import { describe, expect, it } from 'vitest';
import i18n from '../i18n/config';
import { getApiErrorMessage, getBackendErrorCode } from './apiErrors';

describe('api error helpers', () => {
  it('extracts backend error codes from axios-like errors', () => {
    const error = { response: { data: { code: 'AUTH_RESET_OTP_INVALID' } } };

    expect(getBackendErrorCode(error)).toBe('AUTH_RESET_OTP_INVALID');
  });

  it('translates known backend error codes', () => {
    i18n.changeLanguage('en');
    const error = {
      response: {
        data: {
          code: 'AUTH_RESET_OTP_INVALID',
          message: 'Server fallback text',
        },
      },
    };

    expect(getApiErrorMessage(error, 'Fallback')).toBe('The reset code is invalid or expired.');
  });

  it('falls back to backend message for unknown error codes', () => {
    const error = {
      response: {
        data: {
          code: 'UNKNOWN_BACKEND_CODE',
          message: 'Server fallback text',
        },
      },
    };

    expect(getApiErrorMessage(error, 'Fallback')).toBe('Server fallback text');
  });
});
