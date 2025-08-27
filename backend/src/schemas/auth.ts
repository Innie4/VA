import { z } from 'zod';

// Password validation schema
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
  );

// Email validation schema
const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase();

// Name validation schema
const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name must not exceed 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

// User registration schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  }),
});

// User login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

// Email verification schema
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Resend verification email schema
export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// Update profile schema
export const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  bio: z.string().max(500, 'Bio must not exceed 500 characters').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
});

// Two-factor authentication setup schema
export const setupTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// Two-factor authentication verify schema
export const verifyTwoFactorSchema = z.object({
  token: z.string().length(6, 'Two-factor code must be 6 digits').regex(/^\d{6}$/, 'Two-factor code must contain only digits'),
  trustDevice: z.boolean().optional().default(false),
});

// Two-factor authentication disable schema
export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().length(6, 'Two-factor code must be 6 digits').regex(/^\d{6}$/, 'Two-factor code must contain only digits'),
});

// Account deactivation schema
export const deactivateAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
  feedback: z.string().max(1000, 'Feedback must not exceed 1000 characters').optional(),
});

// Social login schema
export const socialLoginSchema = z.object({
  provider: z.enum(['google', 'github', 'facebook']),
  accessToken: z.string().min(1, 'Access token is required'),
  idToken: z.string().optional(),
});

// Device registration schema
export const registerDeviceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceName: z.string().max(100, 'Device name must not exceed 100 characters'),
  deviceType: z.enum(['mobile', 'desktop', 'tablet', 'other']),
  pushToken: z.string().optional(),
});

// Session management schema
export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

// Bulk session revocation schema
export const revokeAllSessionsSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  excludeCurrent: z.boolean().optional().default(true),
});

// Login attempt schema (for rate limiting)
export const loginAttemptSchema = z.object({
  email: emailSchema,
  ipAddress: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address'),
  userAgent: z.string().max(500, 'User agent must not exceed 500 characters'),
  timestamp: z.date().default(() => new Date()),
});

// Password strength validation
export const validatePasswordStrength = (password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;
  else if (password.length >= 8) feedback.push('Consider using 12 or more characters for better security');

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[@$!%*?&]/.test(password)) score += 1;
  else feedback.push('Include special characters (@$!%*?&)');

  // Common patterns check
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /(.)\1{2,}/, // Repeated characters
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score -= 1;
      feedback.push('Avoid common patterns and repeated characters');
      break;
    }
  }

  return {
    score: Math.max(0, Math.min(6, score)),
    feedback,
    isStrong: score >= 4 && feedback.length === 0,
  };
};

// Email validation helper
export const isValidEmail = (email: string): boolean => {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
};

// Password validation helper
export const isValidPassword = (password: string): boolean => {
  try {
    passwordSchema.parse(password);
    return true;
  } catch {
    return false;
  }
};

// Name validation helper
export const isValidName = (name: string): boolean => {
  try {
    nameSchema.parse(name);
    return true;
  } catch {
    return false;
  }
};

// Type exports for TypeScript
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SetupTwoFactorInput = z.infer<typeof setupTwoFactorSchema>;
export type VerifyTwoFactorInput = z.infer<typeof verifyTwoFactorSchema>;
export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;
export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
export type SocialLoginInput = z.infer<typeof socialLoginSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;
export type RevokeAllSessionsInput = z.infer<typeof revokeAllSessionsSchema>;
export type LoginAttemptInput = z.infer<typeof loginAttemptSchema>;