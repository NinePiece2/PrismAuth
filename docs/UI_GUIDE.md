# PrismAuth UI Guide

## Overview

This guide covers the new user interface built with Shadcn UI for managing users, authentication, and OAuth2 applications.

## Features

### 1. User Authentication

#### Registration Page (`/register`)
- Allows new users to create an account
- Fields:
  - Tenant Domain (required)
  - Name (optional)
  - Email (required)
  - Password (required - minimum 8 characters)
- After registration, users are automatically logged in and redirected to the dashboard

#### Login Page (`/login`)
- Secure login for existing users
- Fields:
  - Tenant Domain (required)
  - Email (required)
  - Password (required)
- Admin users are redirected to `/admin/users` after login
- Regular users are redirected to the home page

### 2. Admin User Management (`/admin/users`)

Only accessible by users with the `admin` role.

#### Features:
- **View Users Table**: Displays all users in the tenant with:
  - Name
  - Email
  - Role
  - Status (Active/Inactive)
  - Created date
  
- **Add New Users**: Click "Add User" button to create new users manually
  - Set name, email, password, and role (user or admin)
  
- **Change User Roles**: Select a different role directly from the table dropdown
  - Options: `user` or `admin`
  - Admins cannot change their own role
  
- **Delete Users**: Remove users from the system
  - Admins cannot delete themselves

### 3. OAuth2 Application Management (`/admin/applications`)

Only accessible by users with the `admin` role.

#### Features:
- **View Applications**: Displays all registered OAuth2 applications with:
  - Application name and description
  - Client ID (copyable)
  - Redirect URIs (allowed callback URLs)
  - Allowed scopes
  - Status (Active/Inactive)

- **Add New Applications**: Click "Add Application" button
  - Required fields:
    - Application Name
    - Redirect URIs (comma-separated list of allowed callback URLs)
    - Allowed Scopes (e.g., `openid, profile, email`)
    - Grant Types (e.g., `authorization_code, refresh_token`)
  - Optional fields:
    - Description
  
- **View Client Credentials**: After creating an application, you'll see:
  - Client ID (save this)
  - Client Secret (⚠️ shown only once - copy and save it securely!)
  
- **Delete Applications**: Remove OAuth2 applications when no longer needed

### 4. Dashboard (`/`)

#### For Unauthenticated Users:
- Welcome page with options to Sign In or Register

#### For Authenticated Regular Users:
- Shows user information (email, role)
- Access to logout functionality

#### For Admin Users:
- Shows user information
- Quick access to:
  - Manage Users
  - Manage Applications
- Admin Panel button in navigation

## Navigation

### Main Navigation Bar
Present on authenticated pages:
- **PrismAuth**: Brand/home link
- **Users**: Access user management (admin only)
- **Applications**: Access OAuth2 application management (admin only)
- **User Email**: Shows current user
- **Logout**: Sign out of the system

## Getting Started

### 1. Set Up Your Environment

Make sure you have the required environment variables configured:
```env
DATABASE_URL=your_postgres_connection_string
SESSION_SECRET=your_session_secret
REDIS_URL=your_redis_url (optional)
```

### 2. Create a Tenant

First, create a tenant using the API or database:

```bash
# Using the API
curl -X POST http://localhost:4000/api/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "domain": "mycompany.com"
  }'
```

### 3. Register an Admin User

1. Navigate to `http://localhost:4000/register`
2. Fill in the registration form:
   - Tenant Domain: The domain you created (e.g., `mycompany.com`)
   - Name: Your name
   - Email: Your email
   - Password: Choose a secure password

**Note**: The first user should be manually set to `admin` role in the database:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your-email@example.com';
```

### 4. Access the Admin Panel

1. Log in with your admin account
2. Click "Admin Panel" or navigate to `/admin/users` or `/admin/applications`

## Admin Workflows

### Adding a New User

1. Go to `/admin/users`
2. Click "Add User"
3. Fill in the form:
   - Name (optional)
   - Email (required)
   - Password (required, min 8 chars)
   - Role (user or admin)
4. Click "Create User"
5. The new user can now log in with the provided credentials

### Creating an OAuth2 Application

1. Go to `/admin/applications`
2. Click "Add Application"
3. Fill in the form:
   - **Application Name**: Descriptive name (e.g., "My Mobile App")
   - **Description**: Brief description (optional)
   - **Redirect URIs**: Comma-separated list of allowed callback URLs
     - Example: `https://app.example.com/callback, http://localhost:3000/auth/callback`
   - **Allowed Scopes**: Comma-separated scopes (default: `openid, profile, email`)
   - **Grant Types**: Comma-separated grant types (default: `authorization_code, refresh_token`)
4. Click "Create Application"
5. **Important**: Copy both Client ID and Client Secret immediately (secret won't be shown again)
6. Provide these credentials to your application

### Managing User Roles

1. Go to `/admin/users`
2. Find the user in the table
3. Use the role dropdown to select a new role
4. The change is applied immediately

### Deleting Users or Applications

1. Navigate to the appropriate management page
2. Click the "Delete" button next to the item
3. Confirm the deletion in the popup
4. The item is permanently removed

## Security Features

- ✅ Admin-only routes are protected with role checks
- ✅ Sessions are secured with iron-session
- ✅ Passwords are hashed with bcrypt
- ✅ OAuth2 client secrets are hashed and never stored in plain text
- ✅ Client secrets are only shown once during creation
- ✅ Admins cannot delete themselves
- ✅ Admins cannot change their own role

## Troubleshooting

### "Tenant not found" error during registration
- Ensure the tenant domain exists in the database
- Check that the domain matches exactly (case-sensitive)

### "Unauthorized" when accessing admin pages
- Verify your user account has the `admin` role
- Try logging out and logging back in

### Can't see the client secret
- Client secrets are only shown once during application creation
- If you lost it, you'll need to delete and recreate the application

### Application redirects aren't working
- Ensure the redirect URI in your app matches exactly what's registered
- Check for trailing slashes and protocol (http vs https)

## API Integration

Your OAuth2 applications can now use:

- **Authorization Endpoint**: `POST /api/oauth/authorize`
- **Token Endpoint**: `POST /api/oauth/token`
- **UserInfo Endpoint**: `GET /api/oauth/userinfo`

See `docs/CLIENT_INTEGRATION.md` for detailed integration instructions.

## UI Components

Built with Shadcn UI components:
- Forms with validation
- Data tables with sorting
- Modal dialogs for creation
- Toast notifications for feedback
- Responsive design for mobile and desktop

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI Library**: Shadcn UI (built on Radix UI)
- **Styling**: Tailwind CSS 4
- **Forms**: React Hook Form with Zod validation
- **Notifications**: Sonner for toast messages
