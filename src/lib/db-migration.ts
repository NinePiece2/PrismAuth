/**
 * Database Migration Utilities
 * Automatically ensures database schema is up-to-date for PostgreSQL
 */

import { existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { promisify } from "util";

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
 * Execute a command and return the output
 */
function execCommand(
  command: string,
  args: string[],
  options: { stdio?: "inherit" | "pipe" } = {},
): Promise<{ exitCode: number; stdout?: string; stderr?: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      env: { ...process.env },
      stdio: options.stdio || "pipe",
    });

    if (options.stdio === "inherit") {
      proc.on("close", (code) => {
        resolve({ exitCode: code || 0 });
      });
      proc.on("error", reject);
      return;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ exitCode: code || 0, stdout, stderr });
    });

    proc.on("error", reject);
  });
}

/**
 * Check if database schema is in sync with Prisma schema
 */
async function isSchemaSynced(): Promise<boolean> {
  const configPath = join(process.cwd(), "prisma", "prisma.config.ts");

  // Run prisma migrate status to check for pending migrations
  const { exitCode, stdout = "" } = await execCommand("bun", [
    "prisma",
    "migrate",
    "status",
    "--config",
    configPath,
  ]);

  // Exit code 0 means everything is in sync
  // Check output for phrases indicating pending migrations
  const hasPendingMigrations =
    stdout.includes("following migration have not yet been applied") ||
    stdout.includes("following migrations have not yet been applied") ||
    stdout.includes("Your database is not in sync") ||
    exitCode !== 0;

  return !hasPendingMigrations;
}

/**
 * Run Prisma migrations
 */
async function runMigrations(): Promise<void> {
  console.log("🔄 Checking database schema...");

  const configPath = join(process.cwd(), "prisma", "prisma.config.ts");

  // Use local prisma installation with config file
  const { exitCode } = await execCommand(
    "bun",
    ["prisma", "migrate", "deploy", "--config", configPath],
    { stdio: "inherit" },
  );

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
    // Check if schema is already in sync
    const isSynced = await isSchemaSynced();

    if (isSynced) {
      console.log("✅ Database schema is already up to date");
      return;
    }

    console.log("📝 Pending migrations detected, applying...");
    await runMigrations();
  } catch (error) {
    console.error("❌ Database migration failed:", error);
    // Always throw in development and production to prevent running with wrong schema
    throw new Error(
      "Database schema migration failed. Please run migrations manually: bun run db:migrate",
    );
  }
}
