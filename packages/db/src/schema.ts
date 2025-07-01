import { sql } from "drizzle-orm";
import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  decimal,
  tinyint,
  index,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

//
// ──────────────────────────────────────────────────────────────────────────────
//  ENUMS / SMALL LOOKUP TABLES
// ──────────────────────────────────────────────────────────────────────────────

export const biasEnum = [
  "unknown",
  "left",
  "center",
  "right",
] as const;
export type Bias = (typeof biasEnum)[number];

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
    bias: mysqlEnum("bias", biasEnum).default("unknown"),
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
    groupId: int("group_id").references(() => articleGroups.id, { onDelete: "set null" }),
    title: varchar("title", { length: 512 }).notNull(),
    link: varchar("link", { length: 2048 }).notNull(),
    summary: text("summary"),
    published: datetime("published").notNull(),
    indexed: tinyint("indexed").default(0), // 0 = not in Elastic yet
    imageUrl: text("image_url"),
    bias: mysqlEnum("bias", biasEnum).default("unknown"),
    // New fields for bias analysis
    politicalLeaning: decimal("political_leaning", { precision: 5, scale: 4 }), // e.g., -1.0 (left) to 1.0 (right)
    sensationalism: decimal("sensationalism", { precision: 5, scale: 4 }), // e.g., 0.0 to 1.0
    framingSummary: text("framing_summary"),
    biasAnalyzed: tinyint("bias_analyzed").default(0),
  },
  (t) => ({
    idxSourceDate: index("idx_source_date").on(t.sourceId, t.published),
    idxGroup: index("idx_group").on(t.groupId),
  }),
);

//
// ──────────────────────────────────────────────────────────────────────────────
//  ARTICLE GROUPS
// ──────────────────────────────────────────────────────────────────────────────
//
export const articleGroups = mysqlTable(
  "article_groups",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 512 }).notNull(),
    masterArticleId: int("master_article_id").references(() => articles.id, { onDelete: "set null" }),
    // New fields for group analysis
    neutralSummary: text("neutral_summary"),
    biasSummary: text("bias_summary"),
    mostUnbiasedArticleId: int("most_unbiased_article_id").references(() => articles.id, { onDelete: "set null" }),
    analysisCompleted: tinyint("analysis_completed").default(0),
  },
  (t) => ({
    idxMasterArticle: index("idx_master_article").on(t.masterArticleId),
    idxMostUnbiased: index("idx_most_unbiased").on(t.mostUnbiasedArticleId),
  }),
);

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;