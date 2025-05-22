import { drizzle } from "drizzle-orm/mysql2";
import mysql2 from "mysql2";
import * as schema from "./schema";

// ----------------------------------------------------------------------------
//  Connection setup
// ----------------------------------------------------------------------------
const pool = mysql2.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "openbias",
  database: process.env.DB_NAME ?? "biasdb",
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(pool, { schema, mode: "default" });
// Re‑export tables & types so callers can `import { articles } from "@open-bias/db"`
export * from "./schema";