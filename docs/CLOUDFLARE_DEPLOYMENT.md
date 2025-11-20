# Deploying PrismAuth to Cloudflare Workers

Complete guide for deploying PrismAuth as a Cloudflare Workers application using D1 and KV.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`
- Logged in to Wrangler: `wrangler login`

## Step 1: Create D1 Database

```bash
# Create the D1 database
wrangler d1 create prismauth

# Output will show database_id - save this!
```

## Step 2: Create KV Namespace

```bash
# Create KV namespace for token caching
wrangler kv:namespace create "KV"

# Output will show id - save this!
```

## Step 3: Configure wrangler.toml

Create `wrangler.toml` in your project root:

```toml
name = "prismauth"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "prismauth"
database_id = "your-database-id-here"

# KV Namespace binding
[[kv_namespaces]]
binding = "KV"
id = "your-kv-id-here"

# Environment variables
[vars]
DATA_PROVIDER = "cloudflare"
OAUTH2_ISSUER = "https://auth.yourdomain.com"
BASE_URL = "https://auth.yourdomain.com"
ACCESS_TOKEN_EXPIRY = "3600"
REFRESH_TOKEN_EXPIRY = "2592000"
AUTHORIZATION_CODE_EXPIRY = "600"

# Secrets (set with: wrangler secret put SECRET_NAME)
# - SESSION_SECRET
# - JWT_PRIVATE_KEY
# - JWT_PUBLIC_KEY
```

## Step 4: Apply Database Schema

```bash
# Run the migration
wrangler d1 execute prismauth --file=./migrations/cloudflare-d1-schema.sql
```

## Step 5: Set Secrets

```bash
# Set session secret
wrangler secret put SESSION_SECRET
# Paste your session secret

# Generate and set JWT keys
bun run generate:keys

# Set private key
wrangler secret put JWT_PRIVATE_KEY
# Paste the private key (with \n for newlines)

# Set public key
wrangler secret put JWT_PUBLIC_KEY
# Paste the public key (with \n for newlines)
```

## Step 6: Update Data Access Factory

Update `src/data/index.ts` to support Cloudflare environment:

```typescript
export function createDataAccess(env?: any): IDataAccess {
  const provider =
    env?.DATA_PROVIDER || process.env.DATA_PROVIDER || "postgres";

  switch (provider) {
    case "postgres":
      return new PostgresDataAccess();

    case "cloudflare":
      if (!env || !env.DB || !env.KV) {
        throw new Error("Cloudflare env bindings (DB, KV) are required");
      }
      return new CloudflareDataAccess(env);

    default:
      throw new Error(`Unknown data provider: ${provider}`);
  }
}
```

## Step 7: Create Workers Entry Point

Create `src/index.ts` for Cloudflare Workers:

```typescript
import { CloudflareDataAccess } from "./data/adapters/cloudflare";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  DATA_PROVIDER: string;
  SESSION_SECRET: string;
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  OAUTH2_ISSUER: string;
  BASE_URL: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
  AUTHORIZATION_CODE_EXPIRY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Initialize data access with Cloudflare bindings
    const dataAccess = new CloudflareDataAccess({ DB: env.DB, KV: env.KV });

    // Your Next.js app routing logic here
    // (You may need to adapt Next.js for Workers or use Hono/itty-router)

    return new Response("PrismAuth on Cloudflare Workers", { status: 200 });
  },
};
```

## Step 8: Deploy

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Your app will be live at: https://prismauth.your-subdomain.workers.dev
```

## Step 9: Seed Database (Optional)

Create a seed script for D1:

```typescript
// scripts/seed-cloudflare.ts
import { CloudflareDataAccess } from "../src/data/adapters/cloudflare";

async function seed(env: any) {
  const db = new CloudflareDataAccess(env);

  // Create default tenant
  const tenant = await db.tenants.create({
    name: "Default Tenant",
    domain: "default",
    isActive: true,
    settings: {},
  });

  // Create admin user
  const hashedPassword = await hashPassword("admin123");
  await db.users.create({
    email: "admin@prismauth.local",
    password: hashedPassword,
    name: "Admin User",
    role: "admin",
    isActive: true,
    tenantId: tenant.id,
    emailVerified: new Date(),
  });

  console.log("✅ Database seeded!");
}

// Export for wrangler
export default {
  async fetch(request: Request, env: Env) {
    await seed(env);
    return new Response("Seeded!", { status: 200 });
  },
};
```

Run once:

```bash
wrangler deploy scripts/seed-cloudflare.ts --name prismauth-seed
curl https://prismauth-seed.your-subdomain.workers.dev
```

## Custom Domain Setup

1. **Add custom domain in Cloudflare Dashboard:**
   - Workers & Pages → prismauth → Settings → Domains & Routes
   - Add domain: `auth.yourdomain.com`

2. **Update wrangler.toml:**

   ```toml
   [vars]
   OAUTH2_ISSUER = "https://auth.yourdomain.com"
   BASE_URL = "https://auth.yourdomain.com"
   ```

3. **Redeploy:**
   ```bash
   wrangler deploy
   ```

## Monitoring & Logs

```bash
# View logs in real-time
wrangler tail

# View specific deployment logs
wrangler tail --format pretty
```

## Performance Benefits

**Global Edge Network:**

- Deployed to 300+ cities worldwide
- Sub-10ms response times globally

**D1 Database:**

- SQLite at the edge
- Automatic replication
- Low latency reads

**KV Token Caching:**

- Token lookups: < 1ms
- Automatic expiration
- Global distribution

## Cost Estimate

Cloudflare Workers Free Tier:

- 100,000 requests/day
- Unlimited D1 read operations
- 25 GB D1 storage
- 100,000 KV reads/day
- 1,000 KV writes/day

For most small-medium SSO deployments: **Free!**

Paid Plan ($5/month):

- 10 million requests/month
- Unlimited D1 operations
- 1 million KV operations/month

## Troubleshooting

**"Module not found" errors:**

- Ensure all imports use relative paths
- Cloudflare Workers doesn't support Node.js builtins directly
- Use Cloudflare-compatible alternatives

**"DB is undefined":**

- Check `wrangler.toml` has correct `database_id`
- Verify binding name matches: `binding = "DB"`

**"KV is undefined":**

- Check KV namespace ID in `wrangler.toml`
- Verify binding name: `binding = "KV"`

**Database migration errors:**

- Use `wrangler d1 execute` not `prisma db push`
- SQLite syntax only (no PostgreSQL-specific features)

## Next Steps

- Set up CI/CD with GitHub Actions
- Add monitoring with Cloudflare Analytics
- Configure rate limiting
- Set up Durable Objects for sessions (if needed)

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Workers KV Docs](https://developers.cloudflare.com/kv/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
