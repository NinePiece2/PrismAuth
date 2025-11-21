# Initial Setup Flow

PrismAuth now includes an automatic first-time setup flow that eliminates the need to run the `create-admin.ts` script manually.

## How It Works

1. **Automatic Detection**: When the application starts and no tenants exist in the database, users are automatically redirected to the setup page.

2. **Setup Page** (`/setup`): A user-friendly interface where you can create:
   - Your first tenant (organization)
   - Your first admin user account

3. **Validation**: The setup process includes:
   - Domain format validation
   - Email format validation
   - Password strength requirements (minimum 8 characters)
   - Duplicate prevention (ensures setup only runs once)

## Accessing the Setup

The setup flow is automatically triggered when you:

- Visit the home page (`/`)
- Try to access the login page (`/login`)
- Try to access the register page (`/register`)

If no tenants exist in the database, you'll be redirected to `/setup`.

## Setup Fields

### Tenant Information

- **Tenant Name**: The name of your organization or application
- **Tenant Domain**: A unique domain identifier (e.g., `example.com`)

### Admin Account

- **Admin Name**: Optional display name
- **Admin Email**: Email address for the admin account
- **Admin Password**: Secure password (minimum 8 characters)
- **Confirm Password**: Password confirmation

## API Endpoints

### Check Setup Status

```
GET /api/setup/check
```

Returns:

```json
{
  "setupRequired": true | false
}
```

### Complete Setup

```
POST /api/setup
```

Body:

```json
{
  "tenantName": "My Company",
  "tenantDomain": "mycompany.com",
  "adminName": "John Doe",
  "adminEmail": "admin@mycompany.com",
  "adminPassword": "securepassword"
}
```

## Migration from Script

The previous `scripts/create-admin.ts` script is still available for programmatic or CLI-based setup if needed, but the web-based setup flow is now the recommended approach for initial configuration.

## Security Notes

- Setup can only be completed once (when no tenants exist)
- Once a tenant exists, the setup endpoint will reject further requests
- All passwords are securely hashed using bcrypt
- Domain and email formats are validated
- The setup page checks authentication status and redirects appropriately
