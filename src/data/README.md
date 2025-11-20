# Data Abstraction Layer

This directory contains the data abstraction layer that allows PrismAuth to work with different database backends.

## Architecture

```
data/
├── interfaces.ts           # Repository interfaces and types
├── index.ts               # Factory for creating data access instances
└── adapters/
    ├── postgres.ts        # PostgreSQL implementation (using Prisma)
    ├── cloudflare.ts      # Cloudflare D1 + KV implementation
    └── mysql.ts           # MySQL implementation (coming soon)
```

## Usage

### Basic Usage

```typescript
import { getDataAccess } from "@/data";

// Get data access instance
const db = getDataAccess();

// Use repositories
const tenant = await db.tenants.findByDomain("example");
const user = await db.users.findByEmail("user@example.com", tenant.id);
const clients = await db.oauthClients.listByTenant(tenant.id);
```

### Switching Database Providers

Set the `DATA_PROVIDER` environment variable:

```env
# Use PostgreSQL (default)
DATA_PROVIDER=postgres
DATABASE_URL=postgresql://...

# Use Cloudflare D1
DATA_PROVIDER=cloudflare
# Cloudflare bindings are injected by Workers runtime
```

## Repository Interfaces

All adapters implement these interfaces:

### ITenantRepository

- `findByDomain(domain)` - Find tenant by domain
- `findById(id)` - Find tenant by ID
- `create(data)` - Create new tenant
- `update(id, data)` - Update tenant
- `delete(id)` - Delete tenant
- `list()` - List all tenants

### IUserRepository

- `findByEmail(email, tenantId)` - Find user by email in tenant
- `findById(id)` - Find user by ID
- `create(data)` - Create new user
- `update(id, data)` - Update user
- `delete(id)` - Delete user
- `listByTenant(tenantId)` - List users in tenant

### IOAuthClientRepository

- `findByClientId(clientId)` - Find OAuth client
- `findById(id)` - Find client by ID
- `create(data)` - Create new client
- `update(id, data)` - Update client
- `delete(id)` - Delete client
- `listByTenant(tenantId)` - List clients in tenant

### IAccessTokenRepository

- `findByToken(token)` - Find access token (with caching)
- `create(data)` - Create new token
- `revoke(id)` - Revoke token
- `delete(id)` - Delete token
- `deleteExpired()` - Clean up expired tokens
- `listByUser(userId)` - List user's tokens

### IRefreshTokenRepository

Similar to access tokens

### IAuthorizationCodeRepository

- `findByCode(code)` - Find authorization code
- `create(data)` - Create authorization code
- `markAsUsed(id)` - Mark code as used
- `delete(id)` - Delete code
- `deleteExpired()` - Clean up expired codes

### ISessionRepository

- `findByToken(token)` - Find session
- `create(data)` - Create session
- `update(id, data)` - Update session
- `delete(id)` - Delete session
- `deleteExpired()` - Clean up expired sessions

## Implementing a New Adapter

To add support for a new database:

1. **Create adapter file**: `src/data/adapters/your-db.ts`

2. **Implement all repository interfaces**:

```typescript
import type { IDataAccess, ITenantRepository, ... } from '../interfaces'

class YourDBTenantRepository implements ITenantRepository {
  async findByDomain(domain: string): Promise<Tenant | null> {
    // Your implementation
  }
  // ... implement all methods
}

export class YourDBDataAccess implements IDataAccess {
  public readonly tenants: ITenantRepository
  public readonly users: IUserRepository
  // ... initialize all repositories

  constructor(connection: YourDBConnection) {
    this.tenants = new YourDBTenantRepository(connection)
    this.users = new YourDBUserRepository(connection)
    // ... initialize others
  }
}
```

3. **Register in factory**: Update `src/data/index.ts`:

```typescript
import { YourDBDataAccess } from "./adapters/your-db";

export function createDataAccess(): IDataAccess {
  const provider = getDataProvider();

  switch (provider) {
    case "your-db":
      return new YourDBDataAccess(/* connection */);
    // ... other cases
  }
}
```

4. **Update environment variables**:

```env
DATA_PROVIDER=your-db
YOUR_DB_CONNECTION_STRING=...
```

## PostgreSQL Adapter

**File**: `src/data/adapters/postgres.ts`

- Uses Prisma ORM
- Full transactional support
- Efficient queries with indexes
- Connection pooling

**Schema**: See `prisma/schema.prisma`

## Cloudflare Adapter

**File**: `src/data/adapters/cloudflare.ts`

- Uses D1 (SQLite) for relational data
- Uses KV for token caching (fast lookups)
- Serverless-friendly
- Edge deployment ready

**Setup**:

```bash
# Create D1 database
wrangler d1 create prismauth

# Run migrations
wrangler d1 execute prismauth --file=./migrations/schema.sql
```

**Bindings** (wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "prismauth"
database_id = "..."

[[kv_namespaces]]
binding = "KV"
id = "..."
```

## Performance Considerations

### Caching Strategy

**PostgreSQL**:

- Optional Redis caching layer
- Database indexes for fast lookups

**Cloudflare**:

- KV for token lookups (sub-millisecond reads)
- D1 for relational queries
- Edge caching with automatic replication

### Token Lookups

Tokens are frequently accessed operations:

```typescript
// PostgreSQL: DB query + optional Redis cache
const token = await db.accessTokens.findByToken(tokenString);

// Cloudflare: KV cache first (fast), D1 fallback
const token = await db.accessTokens.findByToken(tokenString);
```

### Cleanup Jobs

Run periodic cleanup:

```typescript
// Delete expired tokens
await db.accessTokens.deleteExpired();
await db.refreshTokens.deleteExpired();
await db.authorizationCodes.deleteExpired();
await db.sessions.deleteExpired();
```

## Testing

Mock the data access layer for testing:

```typescript
import type { IDataAccess } from "@/data/interfaces";

const mockDataAccess: IDataAccess = {
  tenants: {
    findByDomain: jest.fn(),
    // ... mock all methods
  },
  // ... mock all repositories
};
```

## Migration Guide

### From Direct Prisma to Abstraction Layer

**Before**:

```typescript
import { prisma } from "@/lib/db";

const user = await prisma.user.findUnique({ where: { id } });
```

**After**:

```typescript
import { getDataAccess } from "@/data";

const db = getDataAccess();
const user = await db.users.findById(id);
```

### Benefits

✅ **Database Agnostic**: Switch databases without changing business logic  
✅ **Testable**: Easy to mock for unit tests  
✅ **Platform Flexible**: Deploy to Node.js, Cloudflare Workers, Vercel Edge, etc.  
✅ **Type Safe**: Full TypeScript support  
✅ **Performance**: Optimized for each platform

## Future Adapters

Planned implementations:

- [ ] MySQL/MariaDB adapter
- [ ] MongoDB adapter (for NoSQL option)
- [ ] Supabase adapter
- [ ] PlanetScale adapter
- [ ] Vercel Postgres adapter
- [ ] Turso (libSQL) adapter

## Contributing

When adding a new adapter:

1. Implement all repository interfaces
2. Add tests for the adapter
3. Update documentation
4. Add example configuration
5. Submit PR with benchmarks
