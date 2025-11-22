/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts (before any requests are handled)
 */

export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDatabaseSchema } = await import("@/lib/db-migration");
    await ensureDatabaseSchema();
  }
}
