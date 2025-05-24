import { sql } from "drizzle-orm";
import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  tinyint,
  index,
} from "drizzle-orm/mysql-core";

//
// ──────────────────────────────────────────────────────────────────────────────
//  ENUMS / SMALL LOOKUP TABLES
// ──────────────────────────────────────────────────────────────────────────────
// 0 = unknown   1 = left   2 = center   3 = right
//
export const biasEnum = {
  unknown: 0,
  left: 1,
  center: 2,
  right: 3,
} as const;
export type Bias = keyof typeof biasEnum;

//
// ──────────────────────────────────────────────────────────────────────────────
//  SOURCES
// ──────────────────────────────────────────────────────────────────────────────
//
export const sources = mysqlTable(
  "sources",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 128 }).notNull(),
    url: varchar("url", { length: 512 }).notNull(),
    rss: varchar("rss", { length: 512 }).notNull(),
    bias: tinyint("bias").default(biasEnum.unknown),
    fetchedAt: datetime("fetched_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    idxRss: index("idx_rss").on(t.rss),
  }),
);

//
// ──────────────────────────────────────────────────────────────────────────────
//  ARTICLES
// ──────────────────────────────────────────────────────────────────────────────
//
export const articles = mysqlTable(
  "articles",
  {
    id: int("id").primaryKey().autoincrement(),
    sourceId: int("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    link: varchar("link", { length: 2048 }).notNull(),
    summary: text("summary"),
    published: datetime("published").notNull(),
    indexed: tinyint("indexed").default(0), // 0 = not in Elastic yet
    imageUrl: text("image_url"),
    bias: tinyint("bias").default(biasEnum.unknown),
  },
  (t) => ({
    idxSourceDate: index("idx_source_date").on(t.sourceId, t.published),
  }),
);