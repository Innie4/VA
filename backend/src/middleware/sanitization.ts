import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../utils/logger';

// Sanitization options
interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
  stripIgnoreTag?: boolean;
  stripIgnoreTagBody?: string[];
}

// Default sanitization options
const defaultOptions: SanitizationOptions = {
  allowedTags: [],
  allowedAttributes: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

// Sanitize a single value
const sanitizeValue = (value: any, options: SanitizationOptions = defaultOptions): any => {
  if (typeof value === 'string') {
    // Remove HTML tags and potentially malicious content
    const sanitized = DOMPurify.sanitize(value, {
      ALLOWED_TAGS: options.allowedTags || [],
      ALLOWED_ATTR: Object.keys(options.allowedAttributes || {}),
    });
    
    // Additional sanitization for common XSS patterns
    return sanitized
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }
  
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, options));
  }
  
  if (value && typeof value === 'object') {
    const sanitized: any = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val, options);
    }
    return sanitized;
  }
  
  return value;
};

// Sanitize request body
export const sanitizeInput = (options: SanitizationOptions = defaultOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body, options);
      }
      
      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeValue(req.query, options);
      }
      
      // Sanitize route parameters
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeValue(req.params, options);
      }
      
      next();
    } catch (error) {
      logger.error('Sanitization error:', error);
      next(error);
    }
  };
};

// Sanitize specific fields
export const sanitizeFields = (fields: string[], options: SanitizationOptions = defaultOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body && typeof req.body === 'object') {
        for (const field of fields) {
          if (req.body[field] !== undefined) {
            req.body[field] = sanitizeValue(req.body[field], options);
          }
        }
      }
      
      next();
    } catch (error) {
      logger.error('Field sanitization error:', error);
      next(error);
    }
  };
};

// HTML sanitization for rich text content
export const sanitizeHTML = (options: SanitizationOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  allowedAttributes: {
    'a': ['href', 'title'],
    '*': ['class']
  }
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body, options);
      }
      
      next();
    } catch (error) {
      logger.error('HTML sanitization error:', error);
      next(error);
    }
  };
};

// Remove null bytes and control characters
export const removeControlCharacters = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const cleanValue = (value: any): any => {
      if (typeof value === 'string') {
        return value
          .replace(/\0/g, '') // Remove null bytes
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
          .replace(/\uFEFF/g, ''); // Remove BOM
      }
      
      if (Array.isArray(value)) {
        return value.map(cleanValue);
      }
      
      if (value && typeof value === 'object') {
        const cleaned: any = {};
        for (const [key, val] of Object.entries(value)) {
          cleaned[key] = cleanValue(val);
        }
        return cleaned;
      }
      
      return value;
    };
    
    if (req.body) {
      req.body = cleanValue(req.body);
    }
    
    if (req.query) {
      req.query = cleanValue(req.query);
    }
    
    if (req.params) {
      req.params = cleanValue(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Control character removal error:', error);
    next(error);
  }
};

// SQL injection prevention
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const sqlPatterns = [
      /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
      /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
      /(script|javascript|vbscript|onload|onerror|onclick)/i,
    ];
    
    const checkValue = (value: any): boolean => {
      if (typeof value === 'string') {
        return sqlPatterns.some(pattern => pattern.test(value));
      }
      
      if (Array.isArray(value)) {
        return value.some(checkValue);
      }
      
      if (value && typeof value === 'object') {
        return Object.values(value).some(checkValue);
      }
      
      return false;
    };
    
    const hasSQLInjection = [
      req.body,
      req.query,
      req.params
    ].some(checkValue);
    
    if (hasSQLInjection) {
      logger.warn('Potential SQL injection attempt detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      res.status(400).json({
        success: false,
        message: 'Invalid input detected',
        error: {
          code: 'INVALID_INPUT',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    next();
  } catch (error) {
    logger.error('SQL injection prevention error:', error);
    next(error);
  }
};

// Comprehensive input sanitization middleware
export const comprehensiveSanitization = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  removeControlCharacters(req, res, (err) => {
    if (err) return next(err);
    
    preventSQLInjection(req, res, (err) => {
      if (err) return next(err);
      
      sanitizeInput()(req, res, next);
    });
  });
};

export default sanitizeInput;