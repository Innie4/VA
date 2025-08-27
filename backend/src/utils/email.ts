import nodemailer from 'nodemailer';
import { config } from '../config/config';
import { logger } from './logger';
import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';

interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Email transporter
let transporter: nodemailer.Transporter;

/**
 * Initialize email transporter
 */
export const initializeEmail = async (): Promise<void> => {
  try {
    // For development, use Ethereal Email (fake SMTP service)
    if (config.NODE_ENV === 'development') {
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      
      logger.info('Email transporter initialized with Ethereal Email for development');
      logger.info(`Test account: ${testAccount.user}`);
    } else {
      // For production, use configured SMTP settings
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      
      logger.info('Email transporter initialized with production SMTP settings');
    }

    // Verify transporter configuration
    await transporter.verify();
    logger.info('Email transporter verified successfully');
  } catch (error) {
    logger.error('Failed to initialize email transporter:', error);
    throw error;
  }
};

/**
 * Load and compile email template
 */
const loadTemplate = async (templateName: string): Promise<EmailTemplate> => {
  try {
    const templateDir = path.join(__dirname, '..', 'templates', 'emails');
    
    // Load HTML template
    const htmlPath = path.join(templateDir, `${templateName}.html`);
    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    
    // Load text template (optional)
    const textPath = path.join(templateDir, `${templateName}.txt`);
    let textContent = '';
    try {
      textContent = await fs.readFile(textPath, 'utf-8');
    } catch {
      // Text template is optional
    }
    
    // Load subject template (optional)
    const subjectPath = path.join(templateDir, `${templateName}.subject`);
    let subjectContent = '';
    try {
      subjectContent = await fs.readFile(subjectPath, 'utf-8');
    } catch {
      // Subject template is optional
    }
    
    return {
      subject: subjectContent.trim(),
      html: htmlContent,
      text: textContent,
    };
  } catch (error) {
    logger.error(`Failed to load email template ${templateName}:`, error);
    throw new Error(`Email template ${templateName} not found`);
  }
};

/**
 * Send email
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    if (!transporter) {
      throw new Error('Email transporter not initialized');
    }

    let { subject, html, text } = options;
    
    // If template is specified, load and compile it
    if (options.template) {
      const template = await loadTemplate(options.template);
      
      // Compile templates with data
      if (options.data) {
        const subjectTemplate = handlebars.compile(template.subject || subject);
        const htmlTemplate = handlebars.compile(template.html);
        const textTemplate = handlebars.compile(template.text);
        
        subject = template.subject ? subjectTemplate(options.data) : subject;
        html = htmlTemplate(options.data);
        text = template.text ? textTemplate(options.data) : undefined;
      } else {
        subject = template.subject || subject;
        html = template.html;
        text = template.text || undefined;
      }
    }

    const mailOptions = {
      from: {
        name: process.env.SMTP_FROM_NAME || 'AI Chat Application',
        address: process.env.SMTP_FROM_EMAIL || 'noreply@ai-chat.com',
      },
      to: options.to,
      subject,
      html,
      text,
      attachments: options.attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (config.NODE_ENV === 'development') {
      logger.info('Email sent successfully');
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    } else {
      logger.info(`Email sent successfully to ${options.to}`);
    }
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (to: string, firstName: string): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Welcome to AI Chat Application!',
    template: 'welcome',
    data: {
      firstName,
      appName: 'AI Chat Application',
      loginUrl: `${config.cors.origin}/login`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
    },
  });
};

/**
 * Send email verification email
 */
export const sendEmailVerification = async (
  to: string,
  firstName: string,
  verificationToken: string
): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Verify your email address',
    template: 'email-verification',
    data: {
      firstName,
      appName: 'AI Chat Application',
      verificationUrl: `${config.cors.origin}/verify-email?token=${verificationToken}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
    },
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  to: string,
  firstName: string,
  resetToken: string
): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Reset your password',
    template: 'password-reset',
    data: {
      firstName,
      appName: 'AI Chat Application',
      resetUrl: `${config.cors.origin}/reset-password?token=${resetToken}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
      expiryHours: 1,
    },
  });
};

/**
 * Send password changed notification
 */
export const sendPasswordChangedEmail = async (
  to: string,
  firstName: string
): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Password changed successfully',
    template: 'password-changed',
    data: {
      firstName,
      appName: 'AI Chat Application',
      loginUrl: `${config.cors.origin}/login`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
      changeTime: new Date().toLocaleString(),
    },
  });
};

/**
 * Send account deactivation email
 */
export const sendAccountDeactivationEmail = async (
  to: string,
  firstName: string
): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Account deactivated',
    template: 'account-deactivated',
    data: {
      firstName,
      appName: 'AI Chat Application',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
    },
  });
};

/**
 * Send security alert email
 */
export const sendSecurityAlertEmail = async (
  to: string,
  firstName: string,
  alertType: string,
  details: Record<string, any>
): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Security Alert - Unusual Activity Detected',
    template: 'security-alert',
    data: {
      firstName,
      appName: 'AI Chat Application',
      alertType,
      details,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
      timestamp: new Date().toLocaleString(),
    },
  });
};

/**
 * Send subscription notification email
 */
export const sendSubscriptionEmail = async (
  to: string,
  firstName: string,
  subscriptionType: 'upgraded' | 'downgraded' | 'cancelled',
  planName: string
): Promise<void> => {
  await sendEmail({
    to,
    subject: `Subscription ${subscriptionType}`,
    template: 'subscription-update',
    data: {
      firstName,
      appName: 'AI Chat Application',
      subscriptionType,
      planName,
      dashboardUrl: `${config.cors.origin}/dashboard`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
    },
  });
};

/**
 * Send usage limit notification
 */
export const sendUsageLimitEmail = async (
  to: string,
  firstName: string,
  limitType: string,
  currentUsage: number,
  limit: number
): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Usage Limit Notification',
    template: 'usage-limit',
    data: {
      firstName,
      appName: 'AI Chat Application',
      limitType,
      currentUsage,
      limit,
      percentage: Math.round((currentUsage / limit) * 100),
      upgradeUrl: `${config.cors.origin}/upgrade`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ai-chat.com',
    },
  });
};

/**
 * Create default email templates if they don't exist
 */
export const createDefaultTemplates = async (): Promise<void> => {
  const templateDir = path.join(__dirname, '..', 'templates', 'emails');
  
  try {
    await fs.mkdir(templateDir, { recursive: true });
    
    // Welcome email template
    const welcomeHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to {{appName}}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Welcome to {{appName}}!</h1>
        <p>Hi {{firstName}},</p>
        <p>Welcome to {{appName}}! We're excited to have you on board.</p>
        <p>You can now start chatting with our AI assistant and explore all the features we have to offer.</p>
        <p><a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Get Started</a></p>
        <p>If you have any questions, feel free to contact us at {{supportEmail}}.</p>
        <p>Best regards,<br>The {{appName}} Team</p>
    </div>
</body>
</html>
    `;
    
    await fs.writeFile(path.join(templateDir, 'welcome.html'), welcomeHtml.trim());
    
    // Email verification template
    const verificationHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Verify your email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Verify your email address</h1>
        <p>Hi {{firstName}},</p>
        <p>Please click the button below to verify your email address:</p>
        <p><a href="{{verificationUrl}}" style="background-color: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>If you didn't create an account with {{appName}}, you can safely ignore this email.</p>
        <p>If you have any questions, contact us at {{supportEmail}}.</p>
        <p>Best regards,<br>The {{appName}} Team</p>
    </div>
</body>
</html>
    `;
    
    await fs.writeFile(path.join(templateDir, 'email-verification.html'), verificationHtml.trim());
    
    // Password reset template
    const passwordResetHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset your password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #dc2626;">Reset your password</h1>
        <p>Hi {{firstName}},</p>
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        <p><a href="{{resetUrl}}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>This link will expire in {{expiryHours}} hour(s).</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <p>If you have any questions, contact us at {{supportEmail}}.</p>
        <p>Best regards,<br>The {{appName}} Team</p>
    </div>
</body>
</html>
    `;
    
    await fs.writeFile(path.join(templateDir, 'password-reset.html'), passwordResetHtml.trim());
    
    logger.info('Default email templates created successfully');
  } catch (error) {
    logger.error('Failed to create default email templates:', error);
  }
};

// Export default
export default {
  initializeEmail,
  sendEmail,
  sendWelcomeEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountDeactivationEmail,
  sendSecurityAlertEmail,
  sendSubscriptionEmail,
  sendUsageLimitEmail,
  createDefaultTemplates,
};