# PrismAuth Architecture

Comprehensive architectural documentation for the PrismAuth OAuth2/OIDC SSO Provider.

## Overview

PrismAuth is a production-ready OAuth2 2.0 and OpenID Connect compliant Single Sign-On provider built on Next.js 16 with multi-tenancy support, database-backed token storage, and optional Redis caching.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client App                            │
│                     (Your Application)                       │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
             │ 1. Auth Request                 │ 4. API Calls
             │                                 │
┌────────────▼─────────────────────────────────▼──────────────┐
│                      PrismAuth SSO                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Next.js 16 App Router                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │   OAuth2     │  │    Auth      │  │   Admin     │ │ │
│  │  │  Endpoints   │  │  Endpoints   │  │    API      │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │ │
│  └─────────┼──────────────────┼──────────────────┼────────┘ │
│            │                  │                  │          │
│  ┌─────────▼──────────────────▼──────────────────▼────────┐ │
│  │              Business Logic Layer                      │ │
│  │  ┌──────┐  ┌────────┐  ┌──────┐  ┌───────────────┐  │ │
│  │  │ JWT  │  │Session │  │Crypto│  │  Validation   │  │ │
│  │  │Utils │  │Manager │  │Utils │  │   (Zod v4)    │  │ │
│  │  └──────┘  └────────┘  └──────┘  └───────────────┘  │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────────┐ │
│  │              Data Access Layer                          │ │
│  │            Prisma ORM + Redis Cache                     │ │
│  └──────────┬──────────────────────────┬───────────────────┘ │
└─────────────┼──────────────────────────┼─────────────────────┘
              │                          │
   ┌──────────▼──────────┐    ┌─────────▼─────────┐
   │   PostgreSQL DB     │    │   Redis Cache     │
   │  ┌───────────────┐  │    │    (Optional)     │
   │  │   Tenants     │  │    │                   │
   │  │   Users       │  │    │  • Tokens         │
   │  │   Clients     │  │    │  • Sessions       │
   │  │   Tokens      │  │    │  • Rate Limits    │
   │  │   Sessions    │  │    │                   │
   │  └───────────────┘  │    └───────────────────┘
   └─────────────────────┘
```

## Core Components

### 1. OAuth2/OIDC Layer (`/src/app/api/oauth/`)

Implements OAuth2 2.0 and OpenID Connect 1.0 specifications.

**Endpoints:**

- **`/authorize`** - Authorization endpoint (Authorization Code flow)
  - Validates client credentials
  - Redirects to login if user not authenticated
  - Shows consent screen
  - Generates authorization code with PKCE support

- **`/token`** - Token endpoint
  - Exchanges authorization code for tokens
  - Handles refresh token flow
  - Verifies PKCE challenge
  - Issues access tokens, refresh tokens, and ID tokens

- **`/userinfo`** - UserInfo endpoint (OIDC)
  - Returns user claims based on scopes
  - Validates bearer token
  - Respects scope permissions

- **`/consent`** - User consent handling
  - Shows requested scopes
  - Allows user approval/denial
  - Generates authorization code on approval

**Well-Known Endpoints:**

- **`/.well-known/openid-configuration`** - OIDC Discovery
- **`/.well-known/jwks.json`** - JSON Web Key Set

### 2. Authentication Layer (`/src/app/api/auth/`)

Handles user authentication and session management.

**Endpoints:**

- **`/register`** - User registration
  - Creates new user in tenant
  - Hashes password with bcrypt
  - Establishes session

- **`/login`** - User authentication
  - Validates credentials
  - Multi-tenant aware
  - Creates encrypted session

- **`/logout`** - Session termination
  - Destroys user session
  - Clears cookies

- **`/me`** - Current user info
  - Returns authenticated user details
  - Session validation

### 3. Admin API (`/src/app/api/admin/`)

Management endpoints for OAuth2 clients and tenants.

**Endpoints:**

- **`/clients`** - OAuth2 client management
  - List all clients (GET)
  - Create new client (POST)
  - Returns client credentials (secret shown once)

- **`/clients/[id]`** - Single client operations
  - Get client details (GET)
  - Delete client (DELETE)

- **`/tenants`** - Multi-tenant management
  - List tenants (GET)
  - Create tenant (POST)

### 4. Data Models (Prisma Schema)

**Multi-Tenant Architecture:**

```
Tenant (Isolation Boundary)
├── Users (Scoped to tenant)
├── OAuth Clients (Scoped to tenant)
├── Sessions (Scoped to tenant)
├── Authorization Codes (via User)
├── Access Tokens (via User)
└── Refresh Tokens (via User)
```

**Key Models:**

- **Tenant** - Organizational boundary
  - Unique domain identifier
  - Settings (JSON)
  - Active/inactive status

- **User** - User accounts
  - Email + Tenant = unique constraint
  - Password (bcrypt hashed)
  - Role (admin/user)
  - Email verification status

- **OAuthClient** - Registered applications
  - Client ID/Secret (hashed)
  - Redirect URIs (validated)
  - Allowed scopes
  - Grant types

- **AuthorizationCode** - Temporary codes
  - PKCE challenge/method
  - 10-minute expiry
  - Single-use only

- **AccessToken** - Bearer tokens
  - JWT format (RS256)
  - 1-hour expiry
  - Revocation support
  - Scope enforcement

- **RefreshToken** - Long-lived tokens
  - 30-day expiry
  - Revocation support
  - Rotation on use

- **Session** - User sessions
  - Iron-session encrypted
  - HTTP-only cookies
  - 7-day expiry

## Security Architecture

### Token Flow

```
1. Authorization Request
   ┌─────────┐                    ┌──────────┐
   │ Client  │──────auth req──────▶│ /authorize│
   └─────────┘    +client_id       └─────┬────┘
                  +redirect_uri          │
                  +code_challenge        │
                                         ▼
                                    [Authenticate]
                                         │
                                         ▼
                                    [Get Consent]
                                         │
                                         ▼
                                  Generate Auth Code
                                         │
   ┌─────────┐                          │
   │ Client  │◀──────redirect────────────┘
   └────┬────┘      +code
        │           +state
        │
2. Token Exchange
        │
        └──────token req──────▶┌──────────┐
           +code               │  /token  │
           +code_verifier      └────┬─────┘
           +client_secret           │
                                    ▼
                             [Verify PKCE]
                                    │
                                    ▼
                           [Verify Client Secret]
                                    │
                                    ▼
                          Generate Access Token (JWT)
                          Generate Refresh Token
                          Generate ID Token (OIDC)
                                    │
   ┌─────────┐                      │
   │ Client  │◀─────tokens───────────┘
   └────┬────┘  +access_token
        │       +refresh_token
        │       +id_token
        │
3. API Access
        │
        └──────API req──────▶┌───────────┐
           Bearer token      │ /userinfo │
                             └─────┬─────┘
                                   │
                                   ▼
                         [Verify JWT Signature]
                                   │
                                   ▼
                          [Check Token Expiry]
                                   │
                                   ▼
                        [Validate in Database]
                                   │
   ┌─────────┐                     │
   │ Client  │◀─────user info──────┘
   └─────────┘
```

### Security Features

**1. PKCE (Proof Key for Code Exchange)**

- SHA256 code challenge
- Prevents authorization code interception
- Required for public clients

**2. Token Security**

- RS256 JWT signing
- Database-backed validation
- Revocation support
- Short expiry times

**3. Password Security**

- bcrypt hashing (12 rounds)
- Minimum 8 characters
- Stored salted

**4. Session Security**

- Iron-session encryption
- HTTP-only cookies
- Secure flag in production
- SameSite: Lax

**5. Multi-Tenancy Isolation**

- Database-level separation
- Unique constraints per tenant
- Cross-tenant access prevention

**6. Client Security**

- Hashed client secrets
- Redirect URI validation
- Scope enforcement
- Grant type restrictions

## Data Flow Patterns

### User Registration Flow

```
POST /api/auth/register
    ↓
[Validate Input (Zod)]
    ↓
[Check Tenant Exists]
    ↓
[Check User Unique]
    ↓
[Hash Password (bcrypt)]
    ↓
[Create User Record]
    ↓
[Create Session (iron-session)]
    ↓
[Return User Data]
```

### OAuth2 Authorization Code Flow

```
GET /api/oauth/authorize?client_id=...
    ↓
[Validate Parameters]
    ↓
[Check User Session] ──no──▶ Redirect to /login
    │ yes
    ↓
[Verify Client Active]
    ↓
[Validate Redirect URI]
    ↓
[Validate Scopes]
    ↓
Redirect to /consent
    ↓
POST /api/oauth/consent
    ↓
[User Approves]
    ↓
[Generate Auth Code]
    ↓
[Store in DB + PKCE]
    ↓
Redirect to Client with code
    ↓
POST /api/oauth/token
    ↓
[Verify Client Credentials]
    ↓
[Verify Auth Code]
    ↓
[Verify PKCE]
    ↓
[Mark Code as Used]
    ↓
[Generate JWT Access Token]
    ↓
[Generate Refresh Token]
    ↓
[Generate ID Token (OIDC)]
    ↓
[Store Tokens in DB]
    ↓
[Return Tokens to Client]
```

## Caching Strategy (Redis)

**Optional Redis integration for performance:**

- **Token Lookups**: Cache valid tokens (key: `token:${token}`, TTL: token expiry)
- **Client Data**: Cache client configurations (key: `client:${clientId}`, TTL: 1 hour)
- **User Sessions**: Fast session retrieval (key: `session:${sessionToken}`)
- **Rate Limiting**: Track API request rates per client/IP

**Cache Invalidation:**

- Token revocation → Clear cache
- Client update → Clear client cache
- User logout → Clear session cache

## Scalability Considerations

### Horizontal Scaling

- **Stateless API**: Can run multiple instances
- **Session Storage**: Use Redis for shared sessions
- **Database**: PostgreSQL replication
- **Load Balancer**: Distribute traffic across instances

### Performance Optimization

- Redis caching reduces DB queries
- JWT tokens reduce database lookups
- Indexed database queries
- Connection pooling (Prisma)

### High Availability

- Database: Master-replica setup
- Redis: Sentinel or Cluster mode
- Application: Multiple instances behind load balancer
- Health checks on all endpoints

## Technology Stack

| Layer      | Technology       | Purpose                          |
| ---------- | ---------------- | -------------------------------- |
| Framework  | Next.js 16       | React-based full-stack framework |
| Language   | TypeScript       | Type-safe development            |
| Runtime    | Bun/Node.js      | JavaScript runtime               |
| Database   | PostgreSQL       | Relational data storage          |
| ORM        | Prisma           | Type-safe database client        |
| Cache      | Redis (optional) | Performance caching              |
| Session    | iron-session     | Encrypted cookie sessions        |
| JWT        | jose             | JWT signing/verification         |
| Validation | Zod v4           | Schema validation                |
| Hashing    | bcryptjs         | Password hashing                 |

## Extension Points

### Custom Grant Types

Add new OAuth2 flows by:

1. Extend token endpoint handler
2. Add validation schema
3. Implement grant logic

### Additional Claims

Add custom user claims:

1. Extend User model in Prisma
2. Update ID token generation
3. Include in /userinfo response

### Custom Scopes

Define application-specific scopes:

1. Add to OAuthClient.allowedScopes
2. Implement scope validation
3. Return scoped data in /userinfo

### Webhook Integration

Add event notifications:

1. User registration
2. Token issued
3. Client created
4. Failed login attempts

## Monitoring & Logging

**Recommended Logging:**

- Authentication attempts (success/failure)
- Token generation events
- Client registration/deletion
- Admin API access
- Error tracking

**Metrics to Track:**

- Active users per tenant
- Token generation rate
- Failed authentication attempts
- API response times
- Database query performance

## Compliance

**Standards Implemented:**

- OAuth 2.0 (RFC 6749)
- OAuth 2.0 Bearer Token Usage (RFC 6750)
- PKCE (RFC 7636)
- OpenID Connect Core 1.0
- OpenID Connect Discovery 1.0
- JSON Web Token (RFC 7519)
- JSON Web Key (RFC 7517)

## Future Enhancements

- [ ] MFA (Multi-Factor Authentication)
- [ ] Social login providers
- [ ] Email verification workflow
- [ ] Password reset flow
- [ ] Account lockout after failed attempts
- [ ] Audit log system
- [ ] API rate limiting
- [ ] Webhook system for events
- [ ] Custom branding per tenant
- [ ] SAML 2.0 support
- [ ] Admin dashboard UI
- [ ] User profile management UI

## License

MIT License - See LICENSE file for details.
