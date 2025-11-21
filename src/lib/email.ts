/**
 * Email Abstraction Layer
 *
 * This module provides a unified interface for sending emails across different providers.
 * Supported providers: Resend, Console (dev/testing), Custom adapters
 */

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(
    message: EmailMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * Console Email Provider (for development/testing)
 * Logs emails to console instead of sending them
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(
    message: EmailMessage,
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log("\n" + "=".repeat(80));
    console.log("📧 EMAIL (Console Provider - Dev Mode)");
    console.log("=".repeat(80));
    console.log(`To: ${message.to}`);
    console.log(`From: ${message.from}`);
    console.log(`Subject: ${message.subject}`);
    console.log("-".repeat(80));
    console.log("HTML Body:");
    console.log(message.html);
    if (message.text) {
      console.log("-".repeat(80));
      console.log("Text Body:");
      console.log(message.text);
    }
    console.log("=".repeat(80) + "\n");

    return { success: true, messageId: `console-${Date.now()}` };
  }
}

/**
 * Resend Email Provider
 * Uses Resend API to send emails
 */
export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private apiUrl = "https://api.resend.com/emails";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(
    message: EmailMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || "Failed to send email",
        };
      }

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Custom SMTP Email Provider
 * Implement this interface to add support for other email providers
 */
export class CustomEmailProvider implements EmailProvider {
  private config: {
    host: string;
    port: number;
    username: string;
    password: string;
  };

  constructor(config: {
    host: string;
    port: number;
    username: string;
    password: string;
  }) {
    this.config = config;
  }

  async send(
    message: EmailMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement your custom email sending logic here
    // This could use nodemailer, AWS SES, SendGrid, etc.
    console.warn(
      "CustomEmailProvider.send() not implemented. Message:",
      message,
    );
    return {
      success: false,
      error: "Custom email provider not implemented",
    };
  }
}

/**
 * Email Service Singleton
 * Manages the active email provider
 */
class EmailService {
  private provider: EmailProvider;

  constructor() {
    // Initialize with appropriate provider based on environment
    this.provider = this.initializeProvider();
  }

  private initializeProvider(): EmailProvider {
    const emailProvider = process.env.EMAIL_PROVIDER || "console";

    switch (emailProvider.toLowerCase()) {
      case "resend":
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          console.warn(
            "RESEND_API_KEY not found, falling back to console provider",
          );
          return new ConsoleEmailProvider();
        }
        return new ResendEmailProvider(resendApiKey);

      case "custom":
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUsername = process.env.SMTP_USERNAME;
        const smtpPassword = process.env.SMTP_PASSWORD;

        if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
          console.warn(
            "SMTP configuration incomplete, falling back to console provider",
          );
          return new ConsoleEmailProvider();
        }

        return new CustomEmailProvider({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          username: smtpUsername,
          password: smtpPassword,
        });

      case "console":
      default:
        return new ConsoleEmailProvider();
    }
  }

  /**
   * Send an email using the configured provider
   */
  async send(
    message: EmailMessage,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.provider.send(message);
  }

  /**
   * Change the email provider at runtime
   */
  setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  /**
   * Get the current provider (useful for testing)
   */
  getProvider(): EmailProvider {
    return this.provider;
  }
}

// Export singleton instance
export const emailService = new EmailService();

/**
 * Email Templates
 */
export const emailTemplates = {
  accountCreated: (
    email: string,
    password: string,
    loginUrl: string,
    userName?: string,
  ) => ({
    subject: "Welcome to PrismAuth - Account Created",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to PrismAuth</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #000000; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">PrismAuth</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
            <h2 style="color: #333; margin-top: 0;">Welcome to PrismAuth!</h2>
            ${userName ? `<p>Hi ${userName},</p>` : "<p>Hi there,</p>"}
            <p>An administrator has created an account for you. Here are your login credentials:</p>
            <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #e0e0e0; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; font-size: 14px;">${password}</code></p>
            </div>
            <p style="color: #e74c3c; font-weight: bold;">⚠️ You will be required to change this password on your first login.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #000000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login to Your Account</a>
            </div>
            <p style="color: #666; font-size: 14px;">
              For security reasons, please change your password immediately after logging in.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PrismAuth. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to PrismAuth!

${userName ? `Hi ${userName},` : "Hi there,"}

An administrator has created an account for you. Here are your login credentials:

Email: ${email}
Temporary Password: ${password}

⚠️ You will be required to change this password on your first login.

Login here: ${loginUrl}

For security reasons, please change your password immediately after logging in.

© ${new Date().getFullYear()} PrismAuth. All rights reserved.
    `.trim(),
  }),

  mfaEnabled: (userName?: string) => ({
    subject: "Two-Factor Authentication Enabled - PrismAuth",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MFA Enabled</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #000000; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">PrismAuth</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="background: #27ae60; color: white; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 30px;">
                ✓
              </div>
            </div>
            <h2 style="color: #333; margin-top: 0; text-align: center;">Two-Factor Authentication Enabled</h2>
            ${userName ? `<p>Hi ${userName},</p>` : "<p>Hi there,</p>"}
            <p>Two-factor authentication has been successfully enabled on your PrismAuth account.</p>
            <div style="background: #e8f5e9; padding: 16px; border-radius: 6px; border-left: 4px solid #27ae60; margin: 20px 0;">
              <p style="margin: 0; color: #2d6a4f;"><strong>🔒 Your account is now more secure!</strong></p>
              <p style="margin: 8px 0 0 0; color: #2d6a4f; font-size: 14px;">You'll need your authenticator app to log in from now on.</p>
            </div>
            <p style="color: #666; font-size: 14px;">
              <strong>What this means:</strong>
            </p>
            <ul style="color: #666; font-size: 14px;">
              <li>You'll be prompted for a 6-digit code from your authenticator app when logging in</li>
              <li>Keep your backup codes in a safe place - you'll need them if you lose access to your authenticator</li>
              <li>Your account is now protected against unauthorized access</li>
            </ul>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you didn't enable two-factor authentication, please contact your administrator immediately.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PrismAuth. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Two-Factor Authentication Enabled - PrismAuth

${userName ? `Hi ${userName},` : "Hi there,"}

Two-factor authentication has been successfully enabled on your PrismAuth account.

🔒 Your account is now more secure!
You'll need your authenticator app to log in from now on.

What this means:
- You'll be prompted for a 6-digit code from your authenticator app when logging in
- Keep your backup codes in a safe place - you'll need them if you lose access to your authenticator
- Your account is now protected against unauthorized access

If you didn't enable two-factor authentication, please contact your administrator immediately.

© ${new Date().getFullYear()} PrismAuth. All rights reserved.
    `.trim(),
  }),

  passwordChanged: (userName?: string) => ({
    subject: "Password Changed - PrismAuth",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #000000; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">PrismAuth</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
            <h2 style="color: #333; margin-top: 0;">Password Changed Successfully</h2>
            ${userName ? `<p>Hi ${userName},</p>` : "<p>Hi there,</p>"}
            <p>Your password has been successfully changed.</p>
            <div style="background: white; padding: 16px; border-radius: 6px; border: 1px solid #e0e0e0; margin: 20px 0;">
              <p style="margin: 0; color: #666; font-size: 14px;"><strong>Changed:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div style="background: #fff3cd; padding: 16px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>⚠️ Didn't make this change?</strong></p>
              <p style="margin: 8px 0 0 0; color: #856404; font-size: 14px;">If you didn't change your password, please contact your administrator immediately to secure your account.</p>
            </div>
            <p style="color: #666; font-size: 14px;">
              For added security, we recommend enabling two-factor authentication on your account if you haven't already.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PrismAuth. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Password Changed - PrismAuth

${userName ? `Hi ${userName},` : "Hi there,"}

Your password has been successfully changed.

Changed: ${new Date().toLocaleString()}

⚠️ Didn't make this change?
If you didn't change your password, please contact your administrator immediately to secure your account.

For added security, we recommend enabling two-factor authentication on your account if you haven't already.

© ${new Date().getFullYear()} PrismAuth. All rights reserved.
    `.trim(),
  }),

  passwordReset: (resetUrl: string, userName?: string) => ({
    subject: "Reset Your Password - PrismAuth",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #000000; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">PrismAuth</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            ${userName ? `<p>Hi ${userName},</p>` : "<p>Hi there,</p>"}
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #000000; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #e0e0e0; word-break: break-all; font-size: 14px;">
              ${resetUrl}
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <strong>This link will expire in 1 hour.</strong>
            </p>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
            </p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} PrismAuth. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
Reset Your Password - PrismAuth

${userName ? `Hi ${userName},` : "Hi there,"}

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.

© ${new Date().getFullYear()} PrismAuth. All rights reserved.
    `.trim(),
  }),
};
