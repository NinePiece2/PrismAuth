# Database Abstraction Layer Guide

This guide explains how to use PrismAuth's database abstraction layer to switch between different database backends.

## Overview

PrismAuth includes a complete data abstraction layer that allows you to:

- ✅ Switch between PostgreSQL, Cloudflare D1, MySQL, and other databases
- ✅ Write database-agnostic code
- ✅ Deploy to different platforms (Node.js, Cloudflare Workers, Vercel Edge)
- ✅ Test with mock implementations

## Quick Start

### Using the Default (PostgreSQL)

No configuration needed - it works out of the box:

```typescript
import { getDataAccess } from "@/data";

const db = getDataAccess();

// Use any repository
const tenant = await db.tenants.findByDomain("example");
const user = await db.users.findByEmail("user@example.com", tenant.id);
```

### Switching to Cloudflare D1

1. **Set environment variable:**

```env
DATA_PROVIDER=cloudflare
```

2. **Configure Cloudflare bindings** (wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "prismauth"
database_id = "your-db-id"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"
```

3. **Use the same code** - no changes needed!

## Available Adapters

| Adapter           | Status      | Best For                             |
| ----------------- | ----------- | ------------------------------------ |
| **PostgreSQL**    | ✅ Complete | Traditional servers, Vercel, Railway |
| **Cloudflare D1** | 🚧 Partial  | Edge computing, global distribution  |
| **MySQL**         | ⏳ Planned  | Shared hosting, cPanel               |
| **MongoDB**       | ⏳ Planned  | Document-based data                  |
| **Supabase**      | ⏳ Planned  | Supabase deployments                 |

## Repository Methods

All adapters implement the same interface:

### Tenant Repository

```typescript
const db = getDataAccess();

// Find tenant by domain
const tenant = await db.tenants.findByDomain("acme");

// Find by ID
const tenant = await db.tenants.findById("tenant_123");

// Create new tenant
const tenant = await db.tenants.create({
  name: "Acme Corp",
  domain: "acme",
  isActive: true,
  settings: { theme: "dark" },
});

// Update tenant
const updated = await db.tenants.update("tenant_123", {
  name: "Acme Corporation",
});

// Delete tenant
await db.tenants.delete("tenant_123");

// List all tenants
const tenants = await db.tenants.list();
```

### User Repository

```typescript
// Find user by email (scoped to tenant)
const user = await db.users.findByEmail("john@example.com", tenantId);

// Find by ID
const user = await db.users.findById("user_123");

// Create user
const user = await db.users.create({
  email: "john@example.com",
  password: hashedPassword,
  name: "John Doe",
  tenantId: "tenant_123",
  role: "user",
  isActive: true,
});

// Update user
const updated = await db.users.update("user_123", {
  name: "John Smith",
});

// List users in tenant
const users = await db.users.listByTenant("tenant_123");
```

### OAuth Client Repository

```typescript
// Find client
const client = await db.oauthClients.findByClientId("client_abc");

// Create client
const client = await db.oauthClients.create({
  clientId: "client_abc",
  clientSecret: hashedSecret,
  name: "My App",
  redirectUris: ["https://app.example.com/callback"],
  allowedScopes: ["openid", "profile", "email"],
  grantTypes: ["authorization_code", "refresh_token"],
  tenantId: "tenant_123",
  isActive: true,
});

// List tenant's clients
const clients = await db.oauthClients.listByTenant("tenant_123");
```

### Token Repositories

```typescript
// Access tokens
const token = await db.accessTokens.findByToken("token_string");
await db.accessTokens.create({
  token,
  clientId,
  userId,
  scope,
  expiresAt,
  revoked: false,
});
await db.accessTokens.revoke("token_id");
await db.accessTokens.deleteExpired();

// Refresh tokens (same interface)
const refreshToken = await db.refreshTokens.findByToken("refresh_string");
await db.refreshTokens.create({
  token,
  clientId,
  userId,
  scope,
  expiresAt,
  revoked: false,
});
await db.refreshTokens.revoke("token_id");
```

### Authorization Code Repository

```typescript
// Find authorization code
const code = await db.authorizationCodes.findByCode("auth_code_123");

// Create authorization code
await db.authorizationCodes.create({
  code: "auth_code_123",
  clientId: "client_abc",
  userId: "user_123",
  redirectUri: "https://app.example.com/callback",
  scope: ["openid", "profile"],
  expiresAt: new Date(Date.now() + 600000), // 10 minutes
  codeChallenge: "challenge_string",
  codeChallengeMethod: "S256",
  used: false,
});

// Mark as used (prevents reuse)
await db.authorizationCodes.markAsUsed("code_id");

// Cleanup expired codes
await db.authorizationCodes.deleteExpired();
```

## Migrating Existing Code

### Before (Direct Prisma)

```typescript
import { prisma } from "@/lib/db";

export async function getUserByEmail(email: string, tenantId: string) {
  return await prisma.user.findUnique({
    where: { email_tenantId: { email, tenantId } },
  });
}

export async function createClient(data: any) {
  return await prisma.oAuthClient.create({ data });
}
```

### After (Abstraction Layer)

```typescript
import { getDataAccess } from "@/data";

export async function getUserByEmail(email: string, tenantId: string) {
  const db = getDataAccess();
  return await db.users.findByEmail(email, tenantId);
}

export async function createClient(data: any) {
  const db = getDataAccess();
  return await db.oauthClients.create(data);
}
```

**Benefits:**

- ✅ Database-agnostic
- ✅ Easier to test (mock `getDataAccess()`)
- ✅ Can switch providers without code changes

## Performance Tips

### Caching

**PostgreSQL with Redis:**

```typescript
// Token lookups are cached in Redis automatically
const token = await db.accessTokens.findByToken("token_123");
// First call: DB query + Redis cache
// Subsequent calls: Redis only (fast!)
```

**Cloudflare with KV:**

```typescript
// Token lookups use KV (edge-cached)
const token = await db.accessTokens.findByToken("token_123");
// Served from edge cache (< 1ms globally)
```

### Batch Operations

```typescript
// Clean up expired data periodically
const expiredTokens = await db.accessTokens.deleteExpired();
const expiredRefresh = await db.refreshTokens.deleteExpired();
const expiredCodes = await db.authorizationCodes.deleteExpired();
const expiredSessions = await db.sessions.deleteExpired();

console.log(
  `Cleaned up ${expiredTokens + expiredRefresh + expiredCodes + expiredSessions} records`,
);
```

## Testing

### Mock Data Access

```typescript
import { IDataAccess } from "@/data/interfaces";
import { vi } from "vitest";

const mockDb: IDataAccess = {
  tenants: {
    findByDomain: vi.fn().mockResolvedValue({
      id: "tenant_1",
      domain: "test",
      name: "Test Tenant",
      isActive: true,
    }),
    // ... other methods
  },
  users: {
    findByEmail: vi.fn().mockResolvedValue(null),
    // ... other methods
  },
  // ... other repositories
};

// Use in tests
test("should find user", async () => {
  mockDb.users.findByEmail.mockResolvedValue({
    id: "user_1",
    email: "test@example.com",
    // ...
  });

  const user = await mockDb.users.findByEmail("test@example.com", "tenant_1");
  expect(user).toBeDefined();
});
```

## Creating a Custom Adapter

Want to add support for MongoDB, MySQL, or another database? Here's how:

### 1. Create Adapter File

Create `src/data/adapters/your-db.ts`:

```typescript
import type {
  IDataAccess,
  ITenantRepository,
  IUserRepository,
  // ... other interfaces
} from "../interfaces";

class YourDBTenantRepository implements ITenantRepository {
  constructor(private connection: YourDBConnection) {}

  async findByDomain(domain: string): Promise<Tenant | null> {
    // Your implementation using your DB client
    const result = await this.connection.query(
      "SELECT * FROM tenants WHERE domain = ?",
      [domain],
    );
    return result[0] || null;
  }

  // Implement all other methods...
}

export class YourDBDataAccess implements IDataAccess {
  public readonly tenants: ITenantRepository;
  public readonly users: IUserRepository;
  // ... other repositories

  constructor(connection: YourDBConnection) {
    this.tenants = new YourDBTenantRepository(connection);
    this.users = new YourDBUserRepository(connection);
    // ... initialize all repositories
  }
}
```

### 2. Register in Factory

Update `src/data/index.ts`:

```typescript
import { YourDBDataAccess } from "./adapters/your-db";

export function createDataAccess(): IDataAccess {
  const provider = getDataProvider();

  switch (provider) {
    case "your-db":
      const connection = createYourDBConnection(process.env.YOUR_DB_URL);
      return new YourDBDataAccess(connection);

    // ... existing cases
  }
}
```

### 3. Configure Environment

```env
DATA_PROVIDER=your-db
YOUR_DB_URL=your-connection-string
```

### 4. Test

```typescript
import { getDataAccess } from "@/data";

const db = getDataAccess();
const tenant = await db.tenants.findByDomain("test");
```

## Deployment Scenarios

### Traditional Server (Node.js)

**Environment:**

```env
DATA_PROVIDER=postgres
DATABASE_URL=postgresql://...
```

**Deploy to:** Vercel, Railway, Render, AWS, etc.

### Cloudflare Workers (Edge)

**Environment:**

```env
DATA_PROVIDER=cloudflare
```

**wrangler.toml:**

```toml
[[d1_databases]]
binding = "DB"
database_name = "prismauth"

[[kv_namespaces]]
binding = "KV"
```

**Deploy:** `wrangler deploy`

### Hybrid Setup

Run the same codebase in multiple environments:

**US Region** → PostgreSQL (traditional)  
**EU/Asia Regions** → Cloudflare Workers (edge)

Just change `DATA_PROVIDER` per environment!

## Troubleshooting

### "Unknown data provider: xyz"

Make sure `DATA_PROVIDER` is set to a valid value:

- `postgres` (default)
- `cloudflare`
- `mysql` (coming soon)

### "Cloudflare adapter not fully implemented"

The Cloudflare adapter is partially implemented as a reference. To complete it:

1. Implement remaining repository methods
2. Add D1 migration files
3. Test with Cloudflare Workers

### Performance Issues

**PostgreSQL:**

- Enable Redis caching (`REDIS_URL`)
- Add database indexes (already in schema)
- Use connection pooling

**Cloudflare:**

- Token lookups use KV (very fast)
- D1 queries are cached at the edge
- Consider Durable Objects for write-heavy workloads

## Best Practices

1. **Always use the abstraction layer** - Don't import `prisma` directly
2. **Let the factory handle initialization** - Use `getDataAccess()`
3. **Handle errors gracefully** - Database operations can fail
4. **Clean up periodically** - Run `deleteExpired()` jobs
5. **Test with mocks** - Don't hit real databases in unit tests
6. **Monitor performance** - Track query times and cache hit rates

## Resources

- [Repository Interfaces](./src/data/interfaces.ts)
- [PostgreSQL Adapter](./src/data/adapters/postgres.ts)
- [Cloudflare Adapter](./src/data/adapters/cloudflare.ts)
- [Data Access README](./src/data/README.md)

## Contributing

Want to add a new adapter? We welcome contributions!

1. Fork the repository
2. Create your adapter in `src/data/adapters/`
3. Implement all interfaces
4. Add tests
5. Update documentation
6. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.
