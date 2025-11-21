# Email System & Password Reset

This guide covers PrismAuth's email abstraction layer and password reset functionality.

## Overview

PrismAuth includes a flexible email system that supports multiple providers through a unified interface. The system is used for password reset emails and can be extended for other email notifications.

## Features

- **Email Abstraction Layer**: Unified interface for multiple email providers
- **Built-in Providers**:
  - Console (development/testing)
  - Resend
  - Custom SMTP adapters
- **Password Reset Flow**: Complete forgot/reset password functionality
- **Security Features**:
  - Token-based reset with 1-hour expiration
  - One-time use tokens
  - Automatic token invalidation
  - Secure email templates

## Email Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Email Provider Configuration
EMAIL_PROVIDER=console        # Options: console, resend, custom
EMAIL_FROM=noreply@prismauth.com

# Resend Configuration (if using Resend)
RESEND_API_KEY=your_resend_api_key

# Custom SMTP Configuration (if using custom provider)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password

# Application URL (for reset links)
NEXTAUTH_URL=http://localhost:3000
```

### Provider Options

#### 1. Console Provider (Development)

The default provider for development. Logs emails to console instead of sending them.

```env
EMAIL_PROVIDER=console
```

**Use case**: Local development and testing

#### 2. Resend Provider (Recommended for Production)

Uses [Resend](https://resend.com) API for reliable email delivery.

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_123abc...
EMAIL_FROM=noreply@yourdomain.com
```

**Setup**:

1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain
3. Get your API key from the dashboard
4. Add to environment variables

#### 3. Custom SMTP Provider

Use any SMTP provider (Gmail, SendGrid, AWS SES, etc.).

```env
EMAIL_PROVIDER=custom
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
```

**Note**: The custom provider template is included but requires implementation. See "Creating Custom Adapters" below.

## Password Reset Flow

### User Flow

1. **Request Reset**
   - User clicks "Forgot Password?" on login page
   - Enters email address
   - System extracts tenant domain from email

2. **Receive Email**
   - User receives password reset email
   - Email contains secure token link
   - Link expires in 1 hour

3. **Reset Password**
   - User clicks link in email
   - Token is verified
   - User enters new password
   - Password is updated and token is marked as used

4. **Login**
   - User redirected to login page
   - Can now login with new password

### Database Schema

The `PasswordResetToken` model:

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  tenantId  String
  expires   DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}
```

### API Endpoints

#### POST `/api/auth/forgot-password`

Request a password reset email.

**Request Body**:

```json
{
  "email": "user@example.com",
  "tenantDomain": "example.com"
}
```

**Response**:

```json
{
  "message": "If an account exists, a password reset email has been sent"
}
```

**Security Notes**:

- Always returns same message regardless of whether user exists
- Invalidates previous unused tokens
- Rate limiting recommended in production

#### GET `/api/auth/reset-password?token=xxx`

Verify a reset token.

**Query Parameters**:

- `token`: The reset token from email

**Response (Valid)**:

```json
{
  "valid": true,
  "user": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Response (Invalid)**:

```json
{
  "valid": false,
  "error": "Invalid reset token"
}
```

#### POST `/api/auth/reset-password`

Reset the password using a valid token.

**Request Body**:

```json
{
  "token": "abc123...",
  "password": "newPassword123"
}
```

**Response**:

```json
{
  "message": "Password reset successfully"
}
```

**Validation**:

- Password must be at least 8 characters
- Token must be valid, unused, and not expired
- Updates password and marks token as used in a transaction

## Email Templates

### Password Reset Email

Location: `src/lib/email.ts`

The template includes:

- Professional branding with gradient header
- Clear call-to-action button
- Plain text fallback
- Security warnings
- Expiration notice

**Customization**:

```typescript
import { emailTemplates } from "@/lib/email";

const template = emailTemplates.passwordReset(
  resetUrl,
  userName, // optional
);
```

### Creating Custom Templates

Add new templates to `src/lib/email.ts`:

```typescript
export const emailTemplates = {
  passwordReset: (resetUrl: string, userName?: string) => ({
    // existing template
  }),

  // Add your custom template
  welcomeEmail: (userName: string, loginUrl: string) => ({
    subject: "Welcome to PrismAuth",
    html: `...`,
    text: `...`,
  }),
};
```

## Creating Custom Email Adapters

To add support for a new email provider, implement the `EmailProvider` interface:

```typescript
import { EmailProvider, EmailMessage } from "@/lib/email";

export class MyCustomProvider implements EmailProvider {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // Your email sending logic here
      // Use your provider's SDK or API

      return {
        success: true,
        messageId: "msg_123",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

### Example: SendGrid Adapter

```typescript
import sgMail from "@sendgrid/mail";
import { EmailProvider, EmailMessage } from "@/lib/email";

export class SendGridProvider implements EmailProvider {
  constructor(apiKey: string) {
    sgMail.setApiKey(apiKey);
  }

  async send(message: EmailMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const [response] = await sgMail.send({
        to: message.to,
        from: message.from,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      return {
        success: true,
        messageId: response.headers["x-message-id"] as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
```

Add to `src/lib/email.ts`:

```typescript
case "sendgrid":
  const sendGridKey = process.env.SENDGRID_API_KEY;
  if (!sendGridKey) {
    console.warn("SENDGRID_API_KEY not found, falling back to console");
    return new ConsoleEmailProvider();
  }
  return new SendGridProvider(sendGridKey);
```

## Security Best Practices

### Token Security

1. **Random Generation**: Uses `crypto.randomBytes(32)` for secure tokens
2. **One-Time Use**: Tokens marked as used after password reset
3. **Expiration**: 1-hour lifetime for reset tokens
4. **Invalidation**: Previous tokens invalidated when new one requested

### Email Security

1. **No Information Disclosure**: Same response whether user exists or not
2. **Rate Limiting**: Implement at reverse proxy/API gateway level
3. **HTTPS Only**: Reset links should only work over HTTPS in production
4. **Email Verification**: Consider adding email verification for new accounts

### Implementation Recommendations

```typescript
// In production, add rate limiting
// Example with express-rate-limit:
import rateLimit from "express-rate-limit";

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window
  message: "Too many password reset requests, please try again later",
});
```

## Testing

### Development Testing

With `EMAIL_PROVIDER=console`, emails are logged to console:

```
================================================================================
📧 EMAIL (Console Provider - Dev Mode)
================================================================================
To: user@example.com
From: noreply@prismauth.com
Subject: Reset Your Password - PrismAuth
--------------------------------------------------------------------------------
HTML Body:
<!DOCTYPE html>...
================================================================================
```

### Manual Testing Flow

1. Start development server: `bun run dev`
2. Go to `http://localhost:3000/login`
3. Click "Forgot Password?"
4. Enter email address
5. Check console for reset link
6. Copy reset URL from console
7. Open in browser
8. Set new password
9. Login with new password

### Integration Testing

```typescript
// Example test with console provider
import { emailService, ConsoleEmailProvider } from "@/lib/email";

describe("Password Reset", () => {
  beforeAll(() => {
    emailService.setProvider(new ConsoleEmailProvider());
  });

  it("should send password reset email", async () => {
    const result = await emailService.send({
      to: "test@example.com",
      from: "noreply@test.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
});
```

## Migration

After adding the `PasswordResetToken` model, run:

```bash
# Generate Prisma client
bun run db:generate

# Apply migration
bun run db:push

# Or create and apply migration
npx prisma migrate dev --name add_password_reset_tokens
```

## Troubleshooting

### Emails Not Sending (Resend)

1. Check API key is correct
2. Verify domain is verified in Resend dashboard
3. Check `EMAIL_FROM` matches verified domain
4. Review Resend dashboard for delivery logs

### Emails Not Sending (Custom SMTP)

1. Verify SMTP credentials
2. Check firewall/network allows outbound SMTP
3. Test SMTP connection separately
4. Enable detailed logging in your SMTP library

### Reset Links Not Working

1. Verify `NEXTAUTH_URL` is set correctly
2. Check token hasn't expired (1 hour)
3. Ensure token hasn't been used already
4. Check database for token existence

### Console Provider Not Showing Emails

1. Check `EMAIL_PROVIDER=console` is set
2. Ensure console output isn't filtered
3. Look for the `📧 EMAIL` banner in logs

## Production Deployment

### Checklist

- [ ] Set `EMAIL_PROVIDER` to `resend` or `custom`
- [ ] Configure email provider credentials
- [ ] Set `EMAIL_FROM` to your verified domain
- [ ] Set `NEXTAUTH_URL` to production URL
- [ ] Implement rate limiting on reset endpoints
- [ ] Monitor email delivery metrics
- [ ] Set up email bounce/complaint handling
- [ ] Test full reset flow in staging environment

### Monitoring

Track these metrics in production:

- Password reset requests per hour
- Email delivery success rate
- Token usage rate
- Average time from request to reset
- Failed reset attempts

## Future Enhancements

Potential additions to the email system:

1. **Email Verification**: Verify email addresses on registration
2. **Login Notifications**: Alert users of new login attempts
3. **Account Activity**: Notify on password changes, MFA changes
4. **Batch Emails**: Admin notifications, newsletters
5. **Email Queue**: Background job processing for reliability
6. **Email Templates UI**: Admin interface for customizing templates
7. **Multi-language Support**: Localized email templates
8. **Email Analytics**: Open rates, click rates, delivery stats

## API Reference

### EmailProvider Interface

```typescript
interface EmailProvider {
  send(message: EmailMessage): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}
```

### EmailMessage Interface

```typescript
interface EmailMessage {
  to: string; // Recipient email
  from: string; // Sender email (must be verified)
  subject: string; // Email subject line
  html: string; // HTML email body
  text?: string; // Plain text fallback (optional)
}
```

### EmailService Methods

```typescript
// Send an email
await emailService.send(message);

// Change provider at runtime
emailService.setProvider(new ResendEmailProvider(apiKey));

// Get current provider (for testing)
const provider = emailService.getProvider();
```

## Support

For issues or questions:

- Check console logs for detailed error messages
- Verify environment variables are set correctly
- Test with console provider first
- Review email provider documentation
- Check database for token records

## Related Documentation

- [MFA and Password Change](./MFA_AND_PASSWORD_CHANGE.md)
- [Architecture](../ARCHITECTURE.md)
- [Getting Started](../GETTING_STARTED.md)
