import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { createValidationError } from './errorHandler';

// Validation options
interface ValidationOptions {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
}

// Validation middleware factory
export const validate = (schemas: ValidationOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    
    // Validate request body
    if (schemas.body) {
      const { error } = schemas.body.validate(req.body, {
        allowUnknown: schemas.allowUnknown ?? false,
        stripUnknown: schemas.stripUnknown ?? true,
        abortEarly: false,
      });
      
      if (error) {
        errors.push(...error.details.map(detail => `Body: ${detail.message}`));
      }
    }
    
    // Validate query parameters
    if (schemas.query) {
      const { error } = schemas.query.validate(req.query, {
        allowUnknown: schemas.allowUnknown ?? false,
        stripUnknown: schemas.stripUnknown ?? true,
        abortEarly: false,
      });
      
      if (error) {
        errors.push(...error.details.map(detail => `Query: ${detail.message}`));
      }
    }
    
    // Validate route parameters
    if (schemas.params) {
      const { error } = schemas.params.validate(req.params, {
        allowUnknown: schemas.allowUnknown ?? false,
        stripUnknown: schemas.stripUnknown ?? true,
        abortEarly: false,
      });
      
      if (error) {
        errors.push(...error.details.map(detail => `Params: ${detail.message}`));
      }
    }
    
    // Validate headers
    if (schemas.headers) {
      const { error } = schemas.headers.validate(req.headers, {
        allowUnknown: schemas.allowUnknown ?? true,
        stripUnknown: schemas.stripUnknown ?? false,
        abortEarly: false,
      });
      
      if (error) {
        errors.push(...error.details.map(detail => `Headers: ${detail.message}`));
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Validation failed', {
        errors,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      return next(createValidationError(errors.join('; ')));
    }
    
    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  // ID parameter validation
  id: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
  }),
  
  // Pagination query validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('createdAt'),
  }),
  
  // Search query validation
  search: Joi.object({
    q: Joi.string().min(1).max(100).trim(),
    category: Joi.string().max(50),
    tags: Joi.array().items(Joi.string().max(30)),
  }),
  
  // File upload validation
  fileUpload: Joi.object({
    maxSize: Joi.number().integer().min(1).max(10 * 1024 * 1024), // 10MB max
    allowedTypes: Joi.array().items(Joi.string()),
  }),
};

// User validation schemas
export const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]$/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password must not exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required',
      }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required',
    }),
    firstName: Joi.string().min(1).max(50).trim().required(),
    lastName: Joi.string().min(1).max(50).trim().required(),
    acceptTerms: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must accept the terms and conditions',
    }),
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false),
  }),
  
  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),
  
  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]$/)
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]$/)
      .required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
  }),
  
  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(50).trim(),
    lastName: Joi.string().min(1).max(50).trim(),
    bio: Joi.string().max(500).trim().allow(''),
    avatar: Joi.string().uri().allow(''),
    preferences: Joi.object({
      theme: Joi.string().valid('light', 'dark', 'auto'),
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh'),
      notifications: Joi.object({
        email: Joi.boolean(),
        push: Joi.boolean(),
        sms: Joi.boolean(),
      }),
    }),
  }),
  
  updatePreferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto'),
    language: Joi.string().valid('en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'),
    emailNotifications: Joi.boolean(),
    pushNotifications: Joi.boolean(),
    soundEnabled: Joi.boolean(),
    autoSave: Joi.boolean(),
    compactMode: Joi.boolean(),
    showTimestamps: Joi.boolean(),
    fontSize: Joi.string().valid('small', 'medium', 'large'),
    codeTheme: Joi.string().valid('github', 'monokai', 'solarized', 'dracula'),
  }),
  
  deleteAccount: Joi.object({
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
    confirmDeletion: Joi.string().valid('DELETE_MY_ACCOUNT').required().messages({
      'any.only': 'Please type "DELETE_MY_ACCOUNT" to confirm',
      'any.required': 'Confirmation is required',
    }),
    reason: Joi.string().max(500).trim().allow(''),
  }),
};

// Chat validation schemas
export const chatSchemas = {
  sendMessage: Joi.object({
    content: Joi.string().min(1).max(4000).trim().required(),
    conversationId: Joi.string().uuid().required(),
    type: Joi.string().valid('text', 'image', 'file').default('text'),
    metadata: Joi.object({
      model: Joi.string().valid('gpt-4', 'gpt-3.5-turbo'),
      temperature: Joi.number().min(0).max(2),
      maxTokens: Joi.number().min(1).max(4000),
    }),
  }),
  
  createConversation: Joi.object({
    title: Joi.string().min(1).max(100).trim(),
    description: Joi.string().max(500).trim().allow(''),
    isPublic: Joi.boolean().default(false),
    tags: Joi.array().items(Joi.string().max(30)).max(10),
  }),
  
  updateConversation: Joi.object({
    title: Joi.string().min(1).max(100).trim(),
    description: Joi.string().max(500).trim().allow(''),
    isPublic: Joi.boolean(),
    tags: Joi.array().items(Joi.string().max(30)).max(10),
  }),
  
  getConversations: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    search: Joi.string().max(100).trim(),
    tags: Joi.array().items(Joi.string().max(30)),
    isPublic: Joi.boolean(),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'title').default('updatedAt'),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

// File validation schemas
export const fileSchemas = {
  upload: Joi.object({
    purpose: Joi.string().valid('avatar', 'attachment', 'document').required(),
    isPublic: Joi.boolean().default(false),
  }),
  
  getFiles: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    type: Joi.string().valid('image', 'document', 'audio', 'video'),
    purpose: Joi.string().valid('avatar', 'attachment', 'document'),
  }),
  
  updateFile: Joi.object({
    description: Joi.string().max(500).trim().allow(''),
  }),
  
  bulkDelete: Joi.object({
    fileIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
  }),
};

// Admin validation schemas
export const adminSchemas = {
  getUsers: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(100).optional(),
    tier: Joi.string().valid('free', 'premium').optional(),
    isActive: Joi.boolean().optional(),
  }),

  updateUser: Joi.object({
    tier: Joi.string().valid('free', 'premium').optional(),
    isActive: Joi.boolean().optional(),
    roleId: Joi.string().uuid().optional(),
  }).min(1),

  updateSystemSettings: Joi.object({
    settings: Joi.object().pattern(
      Joi.string(),
      Joi.string()
    ).required(),
  }),

  getAuditLogs: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    action: Joi.string().trim().max(100).optional(),
    resource: Joi.string().trim().max(50).optional(),
    userId: Joi.string().uuid().optional(),
  }),

  getAnalytics: Joi.object({
    period: Joi.string().valid('day', 'week', 'month', 'year').default('week'),
  }),
};

// WebSocket validation schemas
export const socketSchemas = {
  joinRoom: Joi.object({
    roomId: Joi.string().uuid().required(),
    roomType: Joi.string().valid('conversation', 'support', 'general').required(),
  }),
  
  sendTyping: Joi.object({
    conversationId: Joi.string().uuid().required(),
    isTyping: Joi.boolean().required(),
  }),
  
  sendMessage: Joi.object({
    content: Joi.string().min(1).max(4000).trim().required(),
    conversationId: Joi.string().uuid().required(),
    type: Joi.string().valid('text', 'image', 'file').default('text'),
  }),
};

// Validation middleware shortcuts
export const validateId = validate({ params: commonSchemas.id });
export const validatePagination = validate({ query: commonSchemas.pagination });
export const validateUserRegister = validate({ body: userSchemas.register });
export const validateUserLogin = validate({ body: userSchemas.login });
export const validateSendMessage = validate({ body: chatSchemas.sendMessage });
export const validateCreateConversation = validate({ body: chatSchemas.createConversation });

// Custom validation functions
export const validateFileUpload = (allowedTypes: string[], maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file && !req.files) {
      return next(createValidationError('No file uploaded'));
    }
    
    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
    
    for (const file of files) {
      if (!file) continue;
      
      // Check file size
      if (file.size > maxSize) {
        return next(createValidationError(`File size exceeds limit of ${maxSize} bytes`));
      }
      
      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return next(createValidationError(`File type ${file.mimetype} is not allowed`));
      }
    }
    
    next();
  };
};



export default validate;