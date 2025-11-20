/**
 * Data Access Factory
 *
 * Creates the appropriate data access implementation based on configuration
 */

import type { IDataAccess } from "./interfaces";
import { PostgresDataAccess } from "./adapters/postgres";
// import { CloudflareDataAccess } from './adapters/cloudflare'
// import { MySQLDataAccess } from './adapters/mysql'

type DataProvider = "postgres" | "cloudflare" | "mysql";

/**
 * Get the configured data provider
 */
function getDataProvider(): DataProvider {
  const provider = process.env.DATA_PROVIDER || "postgres";
  return provider as DataProvider;
}

/**
 * Create and return the appropriate data access implementation
 */
export function createDataAccess(): IDataAccess {
  const provider = getDataProvider();

  switch (provider) {
    case "postgres":
      return new PostgresDataAccess();

    case "cloudflare":
      // For Cloudflare Workers, you'd inject the env bindings
      // return new CloudflareDataAccess(env)
      throw new Error(
        "Cloudflare adapter not fully implemented. See src/data/adapters/cloudflare.ts",
      );

    case "mysql":
      throw new Error("MySQL adapter not implemented yet");

    default:
      throw new Error(`Unknown data provider: ${provider}`);
  }
}

/**
 * Singleton instance of data access
 */
let dataAccessInstance: IDataAccess | null = null;

/**
 * Get the data access instance (singleton)
 */
export function getDataAccess(): IDataAccess {
  if (!dataAccessInstance) {
    dataAccessInstance = createDataAccess();
  }
  return dataAccessInstance;
}

/**
 * Reset the data access instance (useful for testing)
 */
export function resetDataAccess(): void {
  dataAccessInstance = null;
}
