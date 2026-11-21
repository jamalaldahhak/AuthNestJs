export const PASSWORD_RULES = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialCharacter: true,
} as const;

export function isStrongPassword(password: string): boolean {
  if (
    password.length < PASSWORD_RULES.minLength ||
    password.length > PASSWORD_RULES.maxLength
  ) {
    return false;
  }

  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}