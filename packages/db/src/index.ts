import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql2 from "mysql2";
import * as schema from "./schema";
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ----------------------------------------------------------------------------
//  Connection setup
// ----------------------------------------------------------------------------
// Export the pool connection so it can be explicitly closed by scripts
export const poolConnection = mysql2.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "openbias",
  database: process.env.DB_NAME ?? "biasdb",
  waitForConnections: true,
  connectionLimit: 10,
});

export const db: MySql2Database<typeof schema> = drizzle(poolConnection, { schema, mode: "default" });
// Re‑export tables & types so callers can `import { articles } from "@open-bias/db"`
export * from "./schema";

// Export inferred types
export type Source = InferSelectModel<typeof schema.sources>;
export type InsertSource = InferInsertModel<typeof schema.sources>;
export type Article = InferSelectModel<typeof schema.articles>;
export type InsertArticle = InferInsertModel<typeof schema.articles>;

// Export enhanced sources seeding
export { seedExpandedSources, expandedSources } from "./expandedSources";