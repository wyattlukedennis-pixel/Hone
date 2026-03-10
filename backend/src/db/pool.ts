import { Pool } from "pg";

import { config } from "../config.js";

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl || undefined
    });
  }

  return pool;
}
