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
export const articles: any = mysqlTable(
  "articles",
  {
    id: int("id").primaryKey().autoincrement(),
    sourceId: int("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    groupId: int("group_id"),
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
export const articleGroups: any = mysqlTable(
  "article_groups",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 512 }).notNull(),
    masterArticleId: int("master_article_id"),
    // New fields for group analysis
    neutralSummary: text("neutral_summary"),
    biasSummary: text("bias_summary"),
    mostUnbiasedArticleId: int("most_unbiased_article_id"),
    analysisCompleted: tinyint("analysis_completed").default(0),
  },
  (t) => ({
    idxMasterArticle: index("idx_master_article").on(t.masterArticleId),
    idxMostUnbiased: index("idx_most_unbiased").on(t.mostUnbiasedArticleId),
  }),
);

//
// ──────────────────────────────────────────────────────────────────────────────
//  USERS & AUTHENTICATION
// ──────────────────────────────────────────────────────────────────────────────
//
export const users = mysqlTable(
  "users",
  {
    id: int("id").primaryKey().autoincrement(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    name: varchar("name", { length: 255 }),
    role: mysqlEnum("role", ["user", "admin", "moderator"]).default("user"),
    subscriptionTier: mysqlEnum("subscription_tier", ["free", "premium", "pro"]).default("free"),
    createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
    lastLoginAt: datetime("last_login_at"),
    preferences: text("preferences"), // JSON string for user preferences
    isVerified: tinyint("is_verified").default(0),
  },
  (t) => ({
    idxEmail: index("idx_email").on(t.email),
  }),
);

//
// ──────────────────────────────────────────────────────────────────────────────
//  STORY COVERAGE TRACKING
// ──────────────────────────────────────────────────────────────────────────────
//
export const storyCoverage = mysqlTable(
  "story_coverage",
  {
    id: int("id").primaryKey().autoincrement(),
    groupId: int("group_id").notNull().references(() => articleGroups.id, { onDelete: "cascade" }),
    leftCoverage: int("left_coverage").default(0), // Count of left-leaning sources
    centerCoverage: int("center_coverage").default(0), // Count of center sources
    rightCoverage: int("right_coverage").default(0), // Count of right-leaning sources
    totalCoverage: int("total_coverage").default(0), // Total source count
    coverageScore: decimal("coverage_score", { precision: 5, scale: 2 }), // 0-100 coverage completeness
    firstReported: datetime("first_reported"),
    lastUpdated: datetime("last_updated").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  },
  (t) => ({
    idxGroup: index("idx_group").on(t.groupId),
  }),
);

//
// ──────────────────────────────────────────────────────────────────────────────
//  USER INTERACTIONS & RATINGS
// ──────────────────────────────────────────────────────────────────────────────
//
export const userArticleRatings = mysqlTable(
  "user_article_ratings",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    articleId: int("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
    biasRating: decimal("bias_rating", { precision: 3, scale: 2 }), // User's bias rating -10 to +10
    qualityRating: int("quality_rating"), // 1-5 stars for article quality
    helpfulCount: int("helpful_count").default(0), // How many found this rating helpful
    createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    idxUserArticle: index("idx_user_article").on(t.userId, t.articleId),
    uniqueUserArticle: index("unique_user_article").on(t.userId, t.articleId),
  }),
);

//
// ──────────────────────────────────────────────────────────────────────────────
//  BLINDSPOT DETECTION
// ──────────────────────────────────────────────────────────────────────────────
//
export const blindspots = mysqlTable(
  "blindspots",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    groupId: int("group_id").notNull().references(() => articleGroups.id, { onDelete: "cascade" }),
    blindspotType: mysqlEnum("blindspot_type", ["left_missing", "right_missing", "center_missing", "underreported"]),
    severity: mysqlEnum("severity", ["low", "medium", "high"]).default("medium"),
    description: text("description"),
    suggestedSources: text("suggested_sources"), // JSON array of source suggestions
    dismissed: tinyint("dismissed").default(0),
    createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    idxUser: index("idx_user").on(t.userId),
    idxGroup: index("idx_group").on(t.groupId),
  }),
);

//
// ──────────────────────────────────────────────────────────────────────────────
//  AI ANALYSIS TRACKING
// ──────────────────────────────────────────────────────────────────────────────
//
export const aiAnalysisJobs = mysqlTable(
  "ai_analysis_jobs",
  {
    id: int("id").primaryKey().autoincrement(),
    groupId: int("group_id").references(() => articleGroups.id, { onDelete: "cascade" }),
    jobType: mysqlEnum("job_type", ["bias_analysis", "fact_check", "summary_generation", "sentiment_analysis"]),
    status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending"),
    provider: varchar("provider", { length: 100 }), // "openai", "anthropic", etc.
    model: varchar("model", { length: 100 }), // "gpt-4", "claude-3", etc.
    inputData: text("input_data"), // JSON of input parameters
    outputData: text("output_data"), // JSON of analysis results
    tokensUsed: int("tokens_used"),
    costCents: int("cost_cents"), // Cost in cents
    processingTimeMs: int("processing_time_ms"),
    errorMessage: text("error_message"),
    createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
    completedAt: datetime("completed_at"),
  },
  (t) => ({
    idxGroup: index("idx_group").on(t.groupId),
    idxStatus: index("idx_status").on(t.status),
    idxCreated: index("idx_created").on(t.createdAt),
  }),
);

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;