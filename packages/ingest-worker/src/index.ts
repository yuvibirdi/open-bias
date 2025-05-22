/**
 * Ingest‑Worker
 * -------------
 * 1. Reads every RSS feed stored in the `sources` table
 * 2. Parses the feed with rss‑parser
 * 3. Inserts new articles into the `articles` table (idempotent)
 *
 * Run locally with:
 *    bun run packages/ingest-worker/src/index.ts
 * or in watch mode via workspace `dev` script.
 */

import Parser from "rss-parser";
import { db, sources, articles } from "@open-bias/db";
import { eq } from "drizzle-orm";
import { parseISO } from "date-fns";

type RSSItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
};

const parser = new Parser<RSSItem>();

async function ingestOneFeed(src: (typeof sources.$inferSelect)) {
  const feed = await parser.parseURL(src.rss);

  for (const item of feed.items) {
    if (!item.link || !item.title) continue; // malformed entry

    // Has this link already been stored?
    const exists = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.link, item.link))
      .limit(1);

    if (exists.length) continue; // duplicates skipped

    await db.insert(articles).values({
      sourceId: src.id,
      title: item.title,
      link: item.link,
      summary: item.contentSnippet ?? null,
      published: item.pubDate ? parseISO(item.pubDate) : new Date(),
    });

    console.log(`+ [${src.name}] ${item.title}`);
  }
}

async function main() {
  const rows = await db.select().from(sources);

  for (const src of rows) {
    try {
      await ingestOneFeed(src);
    } catch (err) {
      console.error(`Feed failed: ${src.rss}`, err);
    }
  }

  // Optional: close pool (mysql2) so Bun exits cleanly in one‑off mode
  await db.$client.end();
}

main().catch((e) => {
  console.error("Ingest worker fatal:", e);
  process.exit(1);
});