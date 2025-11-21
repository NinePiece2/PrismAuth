import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from project root
config({ path: resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set in .env file");
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
