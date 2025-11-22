/**
 * Database Migration Utilities
 * Automatically ensures database schema is up-to-date for PostgreSQL
 */

import { existsSync } from "fs";
import { join } from "path";

/**
 * Check if using PostgreSQL
 */
function isPostgres(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return !!databaseUrl && databaseUrl.startsWith("postgres");
}

/**
 * Check if migrations directory exists
 */
function hasMigrations(): boolean {
  const migrationsPath = join(process.cwd(), "prisma", "migrations");
  return existsSync(migrationsPath);
}

/**
 * Run Prisma migrations
 */
async function runMigrations(): Promise<void> {
  console.log("🔄 Checking database schema...");

  const schemaPath = join(process.cwd(), "prisma", "schema.prisma");

  // Use local prisma installation (faster than bunx)
  // In production, prisma CLI should be in node_modules
  const proc = Bun.spawn(
    ["bun", "prisma", "migrate", "deploy", "--schema", schemaPath],
    {
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    },
  );

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`Migration failed with exit code ${exitCode}`);
  }

  console.log("✅ Database schema is up to date");
}

/**
 * Ensure database schema is up-to-date
 * Only runs for PostgreSQL databases
 */
export async function ensureDatabaseSchema(): Promise<void> {
  // Skip if explicitly disabled
  if (process.env.AUTO_MIGRATE === "false") {
    console.log("ℹ️  Auto-migration disabled (AUTO_MIGRATE=false)");
    return;
  }

  // Skip in production by default (run migrations separately in CI/CD)
  if (
    process.env.NODE_ENV === "production" &&
    process.env.AUTO_MIGRATE !== "true"
  ) {
    console.log(
      "ℹ️  Skipping auto-migration in production. Run migrations manually or set AUTO_MIGRATE=true",
    );
    return;
  }

  // Skip if not using PostgreSQL
  if (!isPostgres()) {
    console.log("ℹ️  Not using PostgreSQL, skipping schema check");
    return;
  }

  // Skip if no migrations exist
  if (!hasMigrations()) {
    console.log("ℹ️  No migrations found, skipping schema check");
    return;
  }

  // Skip in test environment
  if (process.env.NODE_ENV === "test") {
    return;
  }

  try {
    await runMigrations();
  } catch (error) {
    console.error("❌ Database migration failed:", error);
    // Always throw in development and production to prevent running with wrong schema
    throw new Error(
      "Database schema migration failed. Please run migrations manually: bun run db:migrate",
    );
  }
}
