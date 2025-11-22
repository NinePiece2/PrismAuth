# Production Database Migrations Guide

## Overview

PrismAuth can automatically apply database migrations, but **this is disabled by default in production** for safety reasons.

## Recommended Production Approach

### Option 1: Manual Migrations (Recommended)

Run migrations as part of your deployment pipeline **before** starting the application:

```bash
# In your CI/CD pipeline or deployment script
bun prisma migrate deploy --schema ./prisma/schema.prisma

# Then start the application
bun run start
```

**Advantages:**

- ✅ Full control over when migrations run
- ✅ No race conditions with multiple instances
- ✅ Clear deployment logs
- ✅ Can rollback before deploying app
- ✅ Safer for production

### Option 2: Auto-Migration (Use with Caution)

Enable automatic migrations on startup by setting:

```env
AUTO_MIGRATE=true
```

**⚠️ Warning:** Only use this if:

- You have a **single instance** deployment
- Or you use a **zero-downtime deployment strategy** (e.g., blue-green)
- Or you accept the risk of migration conflicts

## Environment Variables

| Variable       | Default     | Description                                               |
| -------------- | ----------- | --------------------------------------------------------- |
| `AUTO_MIGRATE` | `undefined` | Set to `"true"` to enable auto-migration in production    |
| `AUTO_MIGRATE` | `undefined` | Set to `"false"` to disable auto-migration in development |
| `NODE_ENV`     | -           | `"production"` disables auto-migration by default         |

## Behavior by Environment

### Development (`NODE_ENV=development`)

- ✅ Auto-migration **enabled** by default
- ❌ Stops server if migration fails
- 💡 Suggests running `bun run db:migrate`

### Production (`NODE_ENV=production`)

- ❌ Auto-migration **disabled** by default
- ✅ Must set `AUTO_MIGRATE=true` to enable
- ❌ Throws error if migration fails (prevents running with wrong schema)

### Test (`NODE_ENV=test`)

- ❌ Auto-migration always skipped

## Deployment Strategies

### Docker Deployment

```dockerfile
# In your Dockerfile or docker-compose.yml
CMD bun prisma migrate deploy && bun run start
```

### Kubernetes/Cloud Run

Use an init container or pre-start hook:

```yaml
# Example: Kubernetes Job
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: your-app-image
          command: ["bun", "prisma", "migrate", "deploy"]
      restartPolicy: OnFailure
```

### Platform-Specific (Vercel, Railway, etc.)

Add to your build/start command:

```json
// package.json
{
  "scripts": {
    "build": "bun prisma generate && next build",
    "start": "bun prisma migrate deploy && next start"
  }
}
```

## Migration Best Practices

1. **Test migrations** in staging before production
2. **Backup database** before applying migrations
3. **Use transactions** for complex migrations
4. **Never edit** existing migration files
5. **Review migrations** before deployment
6. **Monitor migration logs** during deployment

## Troubleshooting

### Migration fails in production

If auto-migration is enabled and fails, the app **will not start**. This is intentional to prevent running with an outdated schema.

**Solution:**

1. Check migration logs
2. Fix the issue (database permissions, syntax errors, etc.)
3. Run migration manually: `bun prisma migrate deploy`
4. Restart the application

### Multiple instances conflict

If you have multiple instances starting simultaneously and auto-migration is enabled:

**Problem:** Race condition where multiple instances try to apply migrations

**Solution:**

1. Disable auto-migration (`AUTO_MIGRATE=false` or leave unset)
2. Run migrations in CI/CD before deployment
3. Use rolling deployment strategy (one instance at a time)

### Development vs Production schema drift

**Problem:** Development migrations not in production

**Solution:**

1. Always commit migration files to version control
2. Apply migrations in order of creation
3. Use `prisma migrate deploy` (not `prisma db push`)

## Example Deployment Script

```bash
#!/bin/bash
set -e  # Exit on error

echo "🔄 Starting deployment..."

# 1. Backup database (optional but recommended)
# pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migrations
echo "📦 Applying database migrations..."
bun prisma migrate deploy --schema ./prisma/schema.prisma

# 3. Generate Prisma Client
echo "⚙️  Generating Prisma Client..."
bun prisma generate

# 4. Build application
echo "🔨 Building application..."
bun run build

# 5. Start application
echo "🚀 Starting application..."
bun run start
```

## Monitoring

Consider adding monitoring for:

- Migration success/failure rates
- Migration duration
- Database connection health after migrations
- Schema version tracking

## See Also

- [Prisma Migrations Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Database Setup Guide](./INITIAL_SETUP.md)
- [Architecture Documentation](../ARCHITECTURE.md)
