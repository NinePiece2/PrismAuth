# MFA and Password Change Features

This document describes the implementation of two-factor authentication (MFA/2FA) and forced password change features in PrismAuth.

## Overview

PrismAuth now supports:

1. **Two-Factor Authentication (MFA)**: Users can enable TOTP-based 2FA using authenticator apps
2. **Forced Password Change**: Admins can require users to change their password on first login
3. **Backup Codes**: Users receive 10 one-time backup codes when enabling MFA

## Database Schema

The `User` model has been extended with the following fields:

```prisma
model User {
  // ... existing fields
  mfaEnabled          Boolean   @default(false)
  mfaSecret           String?
  mfaBackupCodes      String[]
  requirePasswordChange Boolean @default(false)
}
```

### Field Descriptions

- `mfaEnabled`: Boolean flag indicating if MFA is enabled for the user
- `mfaSecret`: The TOTP secret key (encrypted/stored securely)
- `mfaBackupCodes`: Array of one-time backup codes for account recovery
- `requirePasswordChange`: Boolean flag set by admins when creating users

## Authentication Flow

### Standard Login (No MFA, No Password Change)

1. User enters email and password
2. System validates credentials
3. Session is created
4. User is redirected to dashboard

### Login with Password Change Required

1. User enters email and password
2. System validates credentials
3. System detects `requirePasswordChange` flag
4. User is shown password change form
5. User enters new password (minimum 8 characters)
6. System validates and updates password, clears flag
7. If MFA is enabled, proceed to MFA verification
8. Otherwise, create session and redirect

### Login with MFA Enabled

1. User enters email and password
2. System validates credentials
3. System detects `mfaEnabled` flag
4. User is shown MFA verification form
5. User enters 6-digit code from authenticator app (or backup code)
6. System verifies code
7. If using backup code, it is removed from the list
8. Session is created
9. User is redirected to dashboard

### Login with Both Password Change and MFA

1. Password change is always checked first
2. After successful password change, user proceeds to MFA verification
3. Only after both steps are complete is a session created

## API Endpoints

### MFA Management

#### POST /api/auth/mfa/setup

Initiates MFA setup for the current user.

**Request**: None (uses current session)

**Response**:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "data:image/png;base64,...",
  "backupCodes": [
    "12345678",
    "23456789",
    // ... 10 codes total
  ]
}
```

#### PATCH /api/auth/mfa/setup

Verifies the MFA code and enables MFA.

**Request**:
```json
{
  "code": "123456"
}
```

**Response**:
```json
{
  "success": true
}
```

#### DELETE /api/auth/mfa/setup

Disables MFA for the current user.

**Request**:
```json
{
  "code": "123456"
}
```

**Response**:
```json
{
  "success": true
}
```

#### POST /api/auth/mfa/verify-login

Verifies MFA code during login process.

**Request**:
```json
{
  "userId": "user-id",
  "code": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

### Password Change

#### POST /api/auth/change-password

Changes password for users with `requirePasswordChange` flag.

**Request**:
```json
{
  "userId": "user-id",
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

**Response (No MFA)**:
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

**Response (MFA Enabled)**:
```json
{
  "success": true,
  "requireMfa": true,
  "userId": "user-id",
  "email": "user@example.com"
}
```

### User Creation (Admin)

#### POST /api/admin/users

Updated to accept `requirePasswordChange` field.

**Request**:
```json
{
  "email": "newuser@example.com",
  "password": "temporary-password",
  "name": "New User",
  "role": "user",
  "requirePasswordChange": true
}
```

## User Interface

### Settings Page (`/settings`)

The settings page allows users to:

1. View account information (email, name, role)
2. Enable/disable two-factor authentication
3. Download backup codes during MFA setup

#### MFA Setup Flow

1. User clicks "Enable Two-Factor Authentication"
2. System generates TOTP secret and QR code
3. Dialog shows:
   - QR code for scanning with authenticator app
   - Manual entry code (base32 secret)
   - 10 backup codes with download button
   - Verification code input field
4. User scans QR code or enters secret manually
5. User enters 6-digit code from authenticator app
6. System verifies code and enables MFA
7. User is encouraged to save backup codes

#### MFA Disable Flow

1. User clicks "Disable Two-Factor Authentication"
2. Dialog prompts for verification code
3. User enters code from authenticator app
4. System verifies and disables MFA

### Login Page (`/login`)

The login page has three states:

1. **Login Form**: Standard email/password entry
2. **Password Change Form**: Shown when `requirePasswordChange` is true
   - New password field
   - Confirm password field
   - Minimum 8 characters validation
3. **MFA Verification Form**: Shown when `mfaEnabled` is true
   - 6-digit code input
   - Auto-formats and limits to numbers only
   - Accepts backup codes as well

### Admin User Creation (`/admin/users`)

Admin user creation dialog includes:

- Name field
- Email field
- Password field
- Role selector (User/Admin)
- **NEW**: "Require password change on first login" checkbox

When checked, the user will be forced to change their password when they first log in.

## Security Considerations

### TOTP Implementation

- Uses HOTP/TOTP standard (RFC 4226/6238)
- 6-digit codes
- 30-second time window
- Secret is generated using cryptographically secure random bytes

### Backup Codes

- 10 codes generated per user
- Each code can only be used once
- Codes are 8 characters long (alphanumeric)
- Stored as an array in the database
- Automatically removed when used

### Password Change

- Requires current password verification
- Minimum 8 characters
- Password is hashed using bcryptjs
- `requirePasswordChange` flag is automatically cleared after successful change
- User cannot access the system until password is changed

### Session Management

- Sessions are only created after all authentication steps are complete
- Partial authentication states (password change, MFA) do not create sessions
- User ID is temporarily stored in component state during multi-step auth

## Supported Authenticator Apps

Any TOTP-compliant authenticator app will work, including:

- Google Authenticator (iOS/Android)
- Microsoft Authenticator (iOS/Android)
- Authy (iOS/Android/Desktop)
- 1Password
- Bitwarden
- LastPass Authenticator
- And many others

## Migration

The database migration `20251120231519_add_mfa_fields` adds the required columns:

```sql
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaBackupCodes" TEXT[];
ALTER TABLE "User" ADD COLUMN "requirePasswordChange" BOOLEAN NOT NULL DEFAULT false;
```

Existing users will have:
- `mfaEnabled` set to `false`
- `mfaSecret` set to `null`
- `mfaBackupCodes` as empty array
- `requirePasswordChange` set to `false`

## Usage Examples

### For Admins

**Creating a user that must change their password:**

1. Go to Admin Panel > Users
2. Click "Add User"
3. Fill in user details
4. Check "Require password change on first login"
5. Click "Create User"
6. Provide the temporary password to the user through a secure channel

### For Users

**Enabling MFA:**

1. Log in to your account
2. Click "Settings" in the navigation
3. In the "Two-Factor Authentication" section, click "Enable Two-Factor Authentication"
4. Scan the QR code with your authenticator app
5. Click "Download Backup Codes" and save them securely
6. Enter the 6-digit code from your authenticator app
7. Click "Enable 2FA"

**Changing Password (When Required):**

1. Log in with your email and temporary password
2. You'll be automatically shown the password change form
3. Enter a new password (minimum 8 characters)
4. Confirm your new password
5. Click "Change Password"

**Using MFA During Login:**

1. Enter email and password as usual
2. After successful password verification, you'll see the MFA screen
3. Open your authenticator app
4. Enter the 6-digit code
5. Click "Verify"

**Using Backup Codes:**

If you don't have access to your authenticator app:

1. At the MFA verification screen, enter one of your backup codes instead of the app code
2. Click "Verify"
3. The backup code will be consumed and cannot be used again

## Troubleshooting

### "Invalid verification code" during MFA setup

- Ensure your device's time is synchronized (TOTP is time-based)
- Wait for the code to refresh and try the new code
- Verify you're entering the code from the correct account in your authenticator app

### "Invalid verification code" during login

- Check device time synchronization
- Try waiting for the next code
- If all else fails, use a backup code

### Lost authenticator device

- Use one of your backup codes to log in
- Immediately go to Settings and disable MFA
- Re-enable MFA with your new device

### Forgot password after forced change

- Contact your admin to reset your password and set a new temporary password
- Admin can update your password and re-enable the `requirePasswordChange` flag

## Testing

To test the features:

1. **Create admin user**: Use the `create-admin.ts` script
2. **Create test user with password change**: Use admin panel with checkbox enabled
3. **Test password change flow**: Log in as the test user
4. **Enable MFA**: Go to Settings > Enable 2FA
5. **Test MFA login**: Log out and log back in
6. **Test backup codes**: Use a backup code during login
7. **Disable MFA**: Go to Settings > Disable 2FA

## Future Enhancements

Potential improvements for future versions:

- SMS-based 2FA as an alternative to TOTP
- WebAuthn/FIDO2 support for hardware keys
- Trusted devices/remember this device feature
- MFA recovery via email
- Admin ability to force MFA for all users
- Password complexity requirements configuration
- Password expiration policies
- Account lockout after failed attempts
