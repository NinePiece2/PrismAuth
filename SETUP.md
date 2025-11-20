# PrismAuth Setup Guide

Complete setup instructions for running PrismAuth OAuth2/OIDC SSO Provider.

## Prerequisites

- **Bun** or Node.js 18+
- **PostgreSQL** 12+ (running locally or remotely)
- **Redis** (optional, for caching)

## Step-by-Step Setup

### 1. Clone and Install

```bash
git clone https://github.com/NinePiece2/PrismAuth.git
cd PrismAuth
bun install
```

### 2. Generate JWT Keys

Generate RSA key pair for signing JWT tokens:

```bash
bun run generate:keys
```

This will output two keys - copy them for the next step.

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure the following:

```env
# Database - Update with your PostgreSQL credentials
DATABASE_URL="postgresql://username:password@localhost:5432/prismauth"

# Redis (optional - comment out if not using)
REDIS_URL="redis://localhost:6379"

# Application
BASE_URL="http://localhost:3000"
OAUTH2_ISSUER="http://localhost:3000"

# Session Secret - Generate a random 32+ character string
SESSION_SECRET="your-super-secret-key-min-32-chars-long"

# OAuth2 Token Expiry (in seconds)
ACCESS_TOKEN_EXPIRY="3600"          # 1 hour
REFRESH_TOKEN_EXPIRY="2592000"      # 30 days
AUTHORIZATION_CODE_EXPIRY="600"     # 10 minutes

# JWT Keys - Paste the keys generated in step 2
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

**Important Notes:**

- Replace `username`, `password`, and database name in `DATABASE_URL`
- Keep the `\n` characters in the JWT keys (they represent newlines)
- Generate a strong random string for `SESSION_SECRET`

### 4. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```bash
# Using psql
createdb prismauth

# Or via PostgreSQL client
psql -U postgres
CREATE DATABASE prismauth;
\q
```

### 5. Initialize Database Schema

Push the Prisma schema to your database:

```bash
bun run db:push
bun run db:generate
```

### 6. Seed Initial Data

Create a default tenant and admin user:

```bash
bun run db:seed
```

This creates:

- **Tenant**: `default` (domain: `default`)
- **Admin User**: `admin@prismauth.local` / `admin123`
- **Demo User**: `demo@prismauth.local` / `demo123`

### 7. Start the Development Server

```bash
bun run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

## Verify Installation

### Check OpenID Configuration

```bash
curl http://localhost:3000/.well-known/openid-configuration
```

Expected response:

```json
{
  "issuer": "http://localhost:3000",
  "authorization_endpoint": "http://localhost:3000/api/oauth/authorize",
  "token_endpoint": "http://localhost:3000/api/oauth/token",
  ...
}
```

### Check JWKS

```bash
curl http://localhost:3000/.well-known/jwks.json
```

Expected response:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      ...
    }
  ]
}
```

## Creating Your First OAuth2 Client

### 1. Login as Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@prismauth.local",
    "password": "admin123",
    "tenantDomain": "default"
  }' \
  -c cookies.txt
```

### 2. Create OAuth2 Client

```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "My Application",
    "description": "My awesome app",
    "redirectUris": ["http://localhost:3001/callback"],
    "allowedScopes": ["openid", "profile", "email"],
    "grantTypes": ["authorization_code", "refresh_token"]
  }'
```

Response:

```json
{
  "clientId": "client_xxxxxxxxxxxx",
  "clientSecret": "yyyyyyyyyyyyyyyy",
  "name": "My Application",
  ...
}
```

**⚠️ IMPORTANT:** Save the `clientSecret` - it's only shown once!

## Testing OAuth2 Flow

### 1. Authorization Request

Open in browser:

```
http://localhost:3000/api/oauth/authorize?response_type=code&client_id=client_xxxx&redirect_uri=http://localhost:3001/callback&scope=openid%20profile%20email&state=random_state
```

### 2. Exchange Code for Token

```bash
curl -X POST http://localhost:3000/api/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "authorization_code_from_callback",
    "redirect_uri": "http://localhost:3001/callback",
    "client_id": "client_xxxx",
    "client_secret": "your_client_secret"
  }'
```

Response:

```json
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "id_token": "eyJhbGc...",
  "scope": "openid profile email"
}
```

### 3. Get User Info

```bash
curl http://localhost:3000/api/oauth/userinfo \
  -H "Authorization: Bearer eyJhbGc..."
```

Response:

```json
{
  "sub": "user_id",
  "email": "demo@prismauth.local",
  "email_verified": true,
  "name": "Demo User",
  "tenant_id": "tenant_id"
}
```

## Database Management

### View Database

```bash
bun run db:studio
```

Opens Prisma Studio at [http://localhost:5555](http://localhost:5555)

### Create Migration

```bash
bun run db:migrate
```

### Reset Database

```bash
# WARNING: This deletes all data!
bun run db:push --force-reset
bun run db:seed
```

## Production Deployment

### 1. Update Environment Variables

```env
NODE_ENV="production"
BASE_URL="https://auth.yourdomain.com"
OAUTH2_ISSUER="https://auth.yourdomain.com"
SESSION_SECRET="<strong-random-secret-64-chars-minimum>"

# Use production database
DATABASE_URL="postgresql://..."

# Use secure cookies
```

### 2. Build Application

```bash
bun run build
```

### 3. Run Production Server

```bash
bun run start
```

### 4. Security Checklist

- ✅ Use HTTPS (SSL/TLS certificates)
- ✅ Strong `SESSION_SECRET` (64+ characters)
- ✅ Secure database credentials
- ✅ Enable Redis for better performance
- ✅ Set up database backups
- ✅ Monitor logs for security events
- ✅ Use strong client secrets
- ✅ Regularly rotate JWT keys
- ✅ Set up rate limiting (reverse proxy)
- ✅ Enable CORS only for trusted origins

## Troubleshooting

### Database Connection Error

```
Error: Can't reach database server
```

**Solution:** Verify PostgreSQL is running and credentials are correct in `.env`

### JWT Key Error

```
Error: JWT private key not configured
```

**Solution:** Run `bun run generate:keys` and add keys to `.env`

### Session Error

```
Error: SESSION_SECRET is not defined
```

**Solution:** Add a strong random secret to `.env`:

```env
SESSION_SECRET="your-random-secret-min-32-chars"
```

### Redis Connection Error

```
Redis connection error
```

**Solution:** Redis is optional. Either:

1. Start Redis: `redis-server`
2. Or remove `REDIS_URL` from `.env`

## Next Steps

- Set up additional tenants via `/api/admin/tenants`
- Configure user roles and permissions
- Integrate with your applications
- Set up monitoring and logging
- Configure email verification (requires SMTP setup)
- Add custom branding/theming

## Support

For issues and questions:

- GitHub Issues: https://github.com/NinePiece2/PrismAuth/issues
- Documentation: [README.md](./README.md)
