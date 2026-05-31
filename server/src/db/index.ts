import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create a shared pg Pool for both Drizzle and Better Auth
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Drizzle client with schema for type-safe queries
export const db = drizzle(pool, { schema });

// Export schema for use in queries
export { schema };
