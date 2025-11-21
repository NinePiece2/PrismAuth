# Email Notifications

PrismAuth includes a flexible email notification system that sends important security and account-related emails to users.

## Email Events

### 1. Account Created by Admin

**Trigger**: When an administrator creates a new user account  
**Content**: Welcome message with login credentials and link to application  
**Purpose**: Provide new users with their initial login information

### 2. Two-Factor Authentication Enabled

**Trigger**: When a user successfully enables MFA  
**Content**: Confirmation that 2FA is now active with security tips  
**Purpose**: Notify users of increased account security

### 3. Password Changed

**Trigger**: When a user changes their password (from settings or forced change)  
**Content**: Confirmation of password change with security warning  
**Purpose**: Alert users to password changes for security monitoring

### 4. Password Reset Request

**Trigger**: When a user requests a password reset  
**Content**: Password reset link (expires in 1 hour)  
**Purpose**: Allow users to securely reset forgotten passwords

## Email Providers

PrismAuth supports multiple email providers:

### Console Provider (Default - Development)

Logs emails to console instead of sending them. Perfect for development and testing.

```env
EMAIL_PROVIDER=console
```

### Resend Provider

Uses the Resend API for production email delivery.

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
```

### Custom Provider

Implement your own email provider (SMTP, AWS SES, SendGrid, etc.)

```env
EMAIL_PROVIDER=custom
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password
EMAIL_FROM=noreply@yourdomain.com
```

## Configuration

### Environment Variables

| Variable         | Description                                           | Default                   |
| ---------------- | ----------------------------------------------------- | ------------------------- |
| `EMAIL_PROVIDER` | Email provider to use (`console`, `resend`, `custom`) | `console`                 |
| `EMAIL_FROM`     | Sender email address                                  | `noreply@prismauth.local` |
| `RESEND_API_KEY` | Resend API key (if using Resend)                      | -                         |
| `SMTP_HOST`      | SMTP server host (if using custom)                    | -                         |
| `SMTP_PORT`      | SMTP server port (if using custom)                    | -                         |
| `SMTP_USERNAME`  | SMTP username (if using custom)                       | -                         |
| `SMTP_PASSWORD`  | SMTP password (if using custom)                       | -                         |

### Example .env Configuration

```env
# Email Configuration
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@yourdomain.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Application URL (used in email links)
BASE_URL=https://auth.yourdomain.com
```

## Email Templates

All email templates are styled with:

- Responsive HTML design
- Dark mode compatible colors
- Professional branding with gradient headers
- Clear call-to-action buttons
- Plain text fallback for compatibility

### Customizing Templates

Templates are defined in `src/lib/email.ts`. To customize:

1. Locate the template in the `emailTemplates` object
2. Modify the HTML and text content
3. Ensure both HTML and text versions are updated
4. Test with console provider first

## Implementation Details

### Email Service Architecture

```typescript
// Send an email
import { emailService, emailTemplates } from "@/lib/email";

const template = emailTemplates.accountCreated(
  email,
  password,
  loginUrl,
  userName,
);

await emailService.send({
  to: userEmail,
  from: config.email.from,
  subject: template.subject,
  html: template.html,
  text: template.text,
});
```

### Error Handling

Email failures are logged but don't block critical operations:

- User creation proceeds even if welcome email fails
- Password changes succeed even if notification fails
- MFA enablement continues even if confirmation fails

This ensures system reliability while maintaining audit trails through logs.

## Testing

### Development Testing

In development, use the console provider to see email output:

```bash
# Terminal will show formatted email output
📧 EMAIL (Console Provider - Dev Mode)
================================================================================
To: user@example.com
From: noreply@prismauth.local
Subject: Welcome to PrismAuth - Account Created
--------------------------------------------------------------------------------
HTML Body:
[Full HTML content...]
================================================================================
```

### Production Testing

Before going live:

1. Test with a real email provider using test credentials
2. Send test emails to your own addresses
3. Verify delivery and spam folder placement
4. Check email rendering across clients (Gmail, Outlook, etc.)
5. Test all email triggers (user creation, MFA, password change)

## Security Considerations

- **Plain Passwords in Email**: Welcome emails contain plain text passwords since they're sent before hashing. Ensure:
  - Users are forced to change passwords on first login
  - Transport is secure (TLS/SSL)
  - Email provider is trusted

- **Email Verification**: Currently emails are sent without verification. Consider adding:
  - Email verification flow for new accounts
  - Confirmation tokens for sensitive actions

- **Rate Limiting**: Consider implementing rate limits for:
  - Password reset requests
  - Account creation by admins
  - MFA setup attempts

## Troubleshooting

### Emails not appearing in console

- Check that `EMAIL_PROVIDER=console` is set
- Ensure terminal/logs are visible
- Check log level settings

### Emails not being sent with Resend

- Verify `RESEND_API_KEY` is correct
- Check domain verification in Resend dashboard
- Review Resend API logs for errors
- Ensure sender email domain is verified

### Emails going to spam

- Configure SPF, DKIM, and DMARC records
- Use verified sending domain
- Avoid spam trigger words
- Warm up new sending domains gradually

## Future Enhancements

Potential improvements for the email system:

- [ ] Email verification flow
- [ ] Email preferences per user
- [ ] Email templates in database
- [ ] Multi-language support
- [ ] Email queue with retry logic
- [ ] Batch email sending
- [ ] Email analytics and tracking
- [ ] Template preview in admin panel
