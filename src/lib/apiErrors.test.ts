import { describe, expect, it } from 'vitest';
import i18n from '../i18n/config';
import { getApiErrorMessage, getApiResponseMessage, getBackendErrorCode } from './apiErrors';

describe('api error helpers', () => {
  it('extracts backend error codes from axios-like errors', () => {
    const error = { response: { data: { code: 'AUTH_RESET_OTP_INVALID' } } };

    expect(getBackendErrorCode(error)).toBe('AUTH_RESET_OTP_INVALID');
  });

  it('extracts nested and alternate backend error code shapes', () => {
    expect(getBackendErrorCode({ response: { data: { error: { code: 'NESTED_CODE' } } } })).toBe('NESTED_CODE');
    expect(getBackendErrorCode({ response: { data: { errorCode: 'ALTERNATE_CODE' } } })).toBe('ALTERNATE_CODE');
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

  it('prefers backend translation keys over backend prose', () => {
    i18n.changeLanguage('en');
    const error = {
      response: {
        data: {
          error: {
            messageKey: 'backendErrors.AUTHENTICATION_REQUIRED',
          },
          message: 'Server fallback text',
        },
      },
    };

    expect(getApiErrorMessage(error, 'Fallback')).toBe('Sign in to continue.');
  });

  it('maps main-app error translation keys to tenant backend error keys', () => {
    i18n.changeLanguage('en');
    const error = {
      response: {
        data: {
          messageKey: 'errors.AUTHENTICATION_REQUIRED',
          message: 'Server fallback text',
        },
      },
    };

    expect(getApiErrorMessage(error, 'Fallback')).toBe('Sign in to continue.');
  });

  it('uses label keys from top-level and nested backend payloads', () => {
    i18n.changeLanguage('en');

    expect(getApiErrorMessage({ response: { data: { labelKey: 'backendErrors.AUTH_TOKEN_INVALID' } } }, 'Fallback'))
      .toBe('Your session token is invalid.');
    expect(getApiErrorMessage({ response: { data: { error: { labelKey: 'backendErrors.USER_NOT_FOUND' } } } }, 'Fallback'))
      .toBe('User not found.');
  });

  it('uses mirrored backend message keys for success responses without backend prose fallback', () => {
    i18n.changeLanguage('en');

    expect(getApiResponseMessage({ messageKey: 'auth.passwordReset.requested', message: 'Backend message' }, 'Fallback'))
      .toBe('If the account exists, a reset code was sent.');
    expect(getApiResponseMessage({ messageKey: 'auth.passwordReset.success', message: 'Backend message' }, 'Fallback'))
      .toBe('Password reset complete. You can sign in with your new password.');
    expect(getApiResponseMessage({ message: 'Backend message' }, 'Fallback')).toBe('Fallback');
  });

  it('uses category fallbacks for known backend code families', () => {
    i18n.changeLanguage('en');
    const error = {
      response: {
        data: {
          code: 'COURSE_NOT_FOUND',
          message: 'Server fallback text',
        },
      },
    };

    expect(getApiErrorMessage(error, 'Fallback')).toBe('The course request could not be completed.');
  });

  it('uses localized fallback instead of backend prose for unknown error codes', () => {
    const error = {
      response: {
        data: {
          code: 'UNKNOWN_BACKEND_CODE',
          message: 'Server fallback text',
        },
      },
    };

    expect(getApiErrorMessage(error, 'Fallback')).toBe('Fallback');
  });
});
