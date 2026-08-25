export interface PasswordPolicyResult {
  valid: boolean;
  reason?: string;
}

export class PasswordPolicy {
  static readonly MIN_LENGTH = 12;
  static readonly MAX_LENGTH = 128;

  validate(password: string): PasswordPolicyResult {
    if (typeof password !== 'string') return { valid: false, reason: 'Password is required' };
    if (password.length < PasswordPolicy.MIN_LENGTH) return { valid: false, reason: 'Password does not meet minimum length' };
    if (password.length > PasswordPolicy.MAX_LENGTH) return { valid: false, reason: 'Password exceeds maximum length' };
    if (/\p{C}/u.test(password)) return { valid: false, reason: 'Password contains unsupported control characters' };
    if (/^\s+$/u.test(password)) return { valid: false, reason: 'Password cannot be whitespace only' };
    if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
      return { valid: false, reason: 'Password must contain at least one letter and one number' };
    }

    const normalized = password.normalize('NFKC').toLowerCase();
    if (PasswordPolicy.COMMON_PASSWORDS.has(normalized)) {
      return { valid: false, reason: 'Password is too common' };
    }

    return { valid: true };
  }

  assertValid(password: string): void {
    const result = this.validate(password);
    if (!result.valid) throw new Error(result.reason ?? 'Invalid password');
  }

  assertConfirmation(password: string, confirmation: string): void {
    if (password !== confirmation) throw new Error('Password confirmation does not match');
  }

  private static readonly COMMON_PASSWORDS = new Set([
    'password123',
    'password1234',
    'qwerty123456',
    'qwertyuiop12',
    '123456789012',
    'letmein12345',
    'welcome12345',
    'admin1234567',
  ]);
}
