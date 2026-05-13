type PasswordSetupErrorMessages = {
  minLength: string;
  mismatch: string;
};

const defaultMessages: PasswordSetupErrorMessages = {
  minLength: 'Password must be at least 8 characters.',
  mismatch: 'Passwords do not match.',
};

export function getPasswordSetupError(
  password: string,
  confirmPassword: string,
  messages: PasswordSetupErrorMessages = defaultMessages,
) {
  if (password.length < 8) return messages.minLength;
  if (password !== confirmPassword) return messages.mismatch;
  return '';
}
