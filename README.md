# PrismAuth

A modern, multi-tenant OAuth2 authentication server built with Next.js, featuring enterprise-grade security with two-factor authentication (2FA/MFA) support.

## Features

- 🏢 **Multi-tenant Architecture**: Isolated authentication per organization/domain
- 🔐 **OAuth2 Server**: Full OAuth2 authorization server implementation
- 👥 **User Management**: Admin interface for managing users and roles
- 🎭 **Custom Roles & Permissions**: Fine-grained access control with per-application permissions
- 🛡️ **Two-Factor Authentication**: TOTP-based 2FA with backup codes
- 🔑 **Forced Password Changes**: Admins can require password changes on first login
- 🎨 **Dark/Light Mode**: System-aware theme with pure black dark mode
- 🚀 **Modern Stack**: Next.js 16, React 19, TypeScript, Prisma, PostgreSQL
- 💅 **Beautiful UI**: Built with Shadcn UI and Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- (Optional) Redis for session storage

### Installation

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

3. Set up your environment variables (see SETUP.md)
4. Run database migrations:

```bash
bun run db:generate
```

```bash
bun run db:migrate
```

5. Create your first admin user:

```bash
bun run scripts/create-admin.ts
```

6. Start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Security Features

### Two-Factor Authentication (MFA)

- TOTP-based authentication using standard authenticator apps
- QR code setup for easy configuration
- 10 one-time backup codes for account recovery
- Support for Google Authenticator, Authy, Microsoft Authenticator, and more

### Password Management

- Admins can force password changes for new users
- Minimum password length requirements
- Secure password hashing with bcryptjs

### Session Management

- Secure cookie-based sessions using iron-session
- Multi-step authentication flow (password → password change → MFA)
- No session creation until all authentication steps complete

## Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) - First-time setup guide
- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [UI_GUIDE.md](./docs/UI_GUIDE.md) - UI components and styling guide
- [CUSTOM_ROLES_PERMISSIONS.md](./docs/CUSTOM_ROLES_PERMISSIONS.md) - Custom roles and permissions system
- [MFA_AND_PASSWORD_CHANGE.md](./docs/MFA_AND_PASSWORD_CHANGE.md) - MFA and password change documentation
- [CLIENT_INTEGRATION.md](./docs/CLIENT_INTEGRATION.md) - OAuth2 client integration guide
- [DATABASE_ADAPTERS.md](./docs/DATABASE_ADAPTERS.md) - Database adapter information

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: Shadcn UI + Tailwind CSS 4
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: iron-session + bcryptjs
- **MFA**: otpauth + qrcode
- **TypeScript**: Fully typed codebase

## User Roles

### Admin (System Role)

- Create and manage users
- Configure OAuth2 applications
- Create and manage custom roles
- Assign application permissions to roles
- Force password changes
- View all tenant data

### User (System Role)

- Access protected resources
- Enable/disable 2FA
- Manage personal settings
- OAuth2 authentication

### Custom Roles

- Admin-defined roles with specific permissions
- Per-application permission sets
- Flexible permission model (read, write, delete, admin, custom)
- Users can have both a system role and a custom role

## OAuth2 Support

PrismAuth implements OAuth2 with support for:

- Authorization Code flow
- Client credentials
- Token generation and validation
- User consent management
- Redirect URI validation

See [CLIENT_INTEGRATION.md](./docs/CLIENT_INTEGRATION.md) for details on integrating OAuth2 clients.

## Contributing

Feel free to make PRs or Issues.

## License

MIT
