import Joi from 'joi';

// Password validation schema
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
    'any.required': 'Password is required'
  });

// Email validation schema
const emailSchema = Joi.string()
  .email()
  .max(254)
  .lowercase()
  .required()
  .messages({
    'string.email': 'Invalid email address',
    'string.max': 'Email must not exceed 254 characters',
    'any.required': 'Email is required'
  });

// Name validation schema
const nameSchema = Joi.string()
  .min(1)
  .max(50)
  .pattern(/^[a-zA-Z\s'-]+$/)
  .trim()
  .required()
  .messages({
    'string.min': 'Name is required',
    'string.max': 'Name must not exceed 50 characters',
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
    'any.required': 'Name is required'
  });

// User registration schema
export const registerSchema = {
  body: Joi.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    acceptTerms: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must accept the terms and conditions',
      'any.required': 'You must accept the terms and conditions'
    })
  })
};

// User login schema
export const loginSchema = {
  body: Joi.object({
    email: emailSchema,
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    }),
    rememberMe: Joi.boolean().default(false)
  })
};

// Refresh token schema
export const refreshTokenSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required'
    })
  })
};

// Forgot password schema
export const forgotPasswordSchema = {
  body: Joi.object({
    email: emailSchema
  })
};

// Reset password schema
export const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required'
    }),
    password: passwordSchema,
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
      'any.required': 'Password confirmation is required',
      'any.only': 'Passwords do not match'
    })
  })
};

// Change password schema
export const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: passwordSchema,
    confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
      'any.required': 'Password confirmation is required',
      'any.only': 'Passwords do not match'
    })
  }).custom((value, helpers) => {
    if (value.currentPassword === value.newPassword) {
      return helpers.error('password.same');
    }
    return value;
  }).messages({
    'password.same': 'New password must be different from current password'
  })
};

// Email verification schema
export const verifyEmailSchema = {
  query: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Verification token is required'
    })
  })
};

// Resend verification email schema
export const resendVerificationSchema = {
  body: Joi.object({
    email: emailSchema
  })
};

// Update profile schema
export const updateProfileSchema = {
  body: Joi.object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    bio: Joi.string().max(500).allow('').messages({
      'string.max': 'Bio must not exceed 500 characters'
    }),
    avatar: Joi.string().uri().allow('').messages({
      'string.uri': 'Invalid avatar URL'
    })
  })
};

// Two-factor authentication setup schema
export const setupTwoFactorSchema = {
  body: Joi.object({
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  })
};

// Two-factor authentication verify schema
export const verifyTwoFactorSchema = {
  body: Joi.object({
    token: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
      'string.length': 'Two-factor code must be 6 digits',
      'string.pattern.base': 'Two-factor code must contain only digits',
      'any.required': 'Two-factor code is required'
    }),
    trustDevice: Joi.boolean().default(false)
  })
};

// Two-factor authentication disable schema
export const disableTwoFactorSchema = {
  body: Joi.object({
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    }),
    token: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
      'string.length': 'Two-factor code must be 6 digits',
      'string.pattern.base': 'Two-factor code must contain only digits',
      'any.required': 'Two-factor code is required'
    })
  })
};

// Account deactivation schema
export const deactivateAccountSchema = {
  body: Joi.object({
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    }),
    reason: Joi.string().max(500).allow('').messages({
      'string.max': 'Reason must not exceed 500 characters'
    }),
    feedback: Joi.string().max(1000).allow('').messages({
      'string.max': 'Feedback must not exceed 1000 characters'
    })
  })
};

// Social login schema
export const socialLoginSchema = {
  body: Joi.object({
    provider: Joi.string().valid('google', 'github', 'facebook').required().messages({
      'any.only': 'Invalid social provider',
      'any.required': 'Social provider is required'
    }),
    accessToken: Joi.string().required().messages({
      'any.required': 'Access token is required'
    }),
    idToken: Joi.string().optional()
  })
};

// Device registration schema
export const registerDeviceSchema = {
  body: Joi.object({
    deviceId: Joi.string().required().messages({
      'any.required': 'Device ID is required'
    }),
    deviceName: Joi.string().max(100).required().messages({
      'string.max': 'Device name must not exceed 100 characters',
      'any.required': 'Device name is required'
    }),
    deviceType: Joi.string().valid('mobile', 'desktop', 'tablet', 'other').required().messages({
      'any.only': 'Invalid device type',
      'any.required': 'Device type is required'
    }),
    pushToken: Joi.string().optional()
  })
};

// Session management schema
export const revokeSessionSchema = {
  params: Joi.object({
    sessionId: Joi.string().uuid().required().messages({
      'string.uuid': 'Invalid session ID',
      'any.required': 'Session ID is required'
    })
  })
};

// Bulk session revocation schema
export const revokeAllSessionsSchema = {
  body: Joi.object({
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    }),
    excludeCurrent: Joi.boolean().default(true)
  })
};

// Login attempt schema (for rate limiting)
export const loginAttemptSchema = {
  body: Joi.object({
    email: emailSchema,
    ipAddress: Joi.string().ip().required().messages({
      'string.ip': 'Invalid IP address',
      'any.required': 'IP address is required'
    }),
    userAgent: Joi.string().max(500).required().messages({
      'string.max': 'User agent must not exceed 500 characters',
      'any.required': 'User agent is required'
    }),
    timestamp: Joi.date().default(() => new Date())
  })
};

// Pagination schema
export const paginationSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.min': 'Page number must be greater than 0'
    }),
    limit: Joi.number().integer().min(1).max(100).default(20).messages({
      'number.min': 'Limit must be greater than 0',
      'number.max': 'Limit must not exceed 100'
    }),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
      'any.only': 'Sort order must be either asc or desc'
    })
  })
};

// Search schema
export const searchSchema = {
  query: Joi.object({
    q: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Search query is required',
      'string.max': 'Search query must not exceed 100 characters',
      'any.required': 'Search query is required'
    }),
    ...paginationSchema.query.describe().keys
  })
};

// File upload validation
export const fileUploadSchema = {
  body: Joi.object({
    description: Joi.string().max(500).allow('').messages({
      'string.max': 'Description must not exceed 500 characters'
    }),
    tags: Joi.array().items(Joi.string().max(50)).max(10).messages({
      'array.max': 'Maximum 10 tags allowed',
      'string.max': 'Tag must not exceed 50 characters'
    }),
    isPublic: Joi.boolean().default(false)
  })
};

// Password strength validation helper
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
  const { error } = emailSchema.validate(email);
  return !error;
};

// Password validation helper
export const isValidPassword = (password: string): boolean => {
  const { error } = passwordSchema.validate(password);
  return !error;
};

// Name validation helper
export const isValidName = (name: string): boolean => {
  const { error } = nameSchema.validate(name);
  return !error;
};

// Export all schemas
export default {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  updateProfileSchema,
  setupTwoFactorSchema,
  verifyTwoFactorSchema,
  disableTwoFactorSchema,
  deactivateAccountSchema,
  socialLoginSchema,
  registerDeviceSchema,
  revokeSessionSchema,
  revokeAllSessionsSchema,
  loginAttemptSchema,
  paginationSchema,
  searchSchema,
  fileUploadSchema,
  validatePasswordStrength,
  isValidEmail,
  isValidPassword,
  isValidName,
};