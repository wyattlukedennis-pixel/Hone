import { Pool } from "pg";

import { config } from "../config.js";

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl || undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Prevent unhandled pool errors from crashing the process
    pool.on("error", () => {});
  }

  return pool;
}
