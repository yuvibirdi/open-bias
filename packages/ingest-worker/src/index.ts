/**
 * Ingest‑Worker
 * -------------
 * 1. Reads every RSS feed stored in the `sources` table (expects `sources.bias` to be set)
 * 2. Parses the feed with rss‑parser
 * 3. Inserts new articles into the `articles` table (idempotent), including `imageUrl` and `bias`.
 *
 * Run locally with:
 *    bun run packages/ingest-worker/src/index.ts
 * or in watch mode via workspace `dev` script.
 */

import Parser from "rss-parser";
import { db, sources, articles, type Source, type InsertArticle } from "@open-bias/db";
import { eq } from "drizzle-orm";
import { parseISO } from "date-fns";

// Extend RSSItem type to include potential image fields
type RSSItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  enclosure?: {
    url?: string;
    type?: string;
  };
  image?: string | { url?: string }; // some feeds use <image><url>...
  itunes?: { image?: string }; // For podcasts or feeds with iTunes namespace
  media?: { content?: { $: { url?: string } }[] }; // Media RSS
  mediaContent?: Array<{ $?: { url?: string; medium?: string } }>; // Media content array
  [key: string]: unknown; // Allow other fields
};

const parser = new Parser<unknown, RSSItem>({ // Specify custom fields for parser to pick up
  customFields: {
    item: [
      'enclosure',
      ['media:content', 'mediaContent', { keepArray: true }]
      // add other potential image fields if necessary, e.g. 'image', 'itunes:image'
    ]
  }
});

async function ingestOneFeed(src: Source) { // Use Source type from db
  if (src.bias === null || typeof src.bias === 'undefined') {
    console.warn(`[${src.name}] Source is missing a bias value or it is null. Skipping article bias assignment.`);
    // Or handle as an error if bias is mandatory for ingestion
  }

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

    let imageUrl: string | null = null;
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      imageUrl = item.enclosure.url;
    } else if (item.itunes?.image) {
      imageUrl = item.itunes.image;
    } else if (typeof item.image === 'string') {
        imageUrl = item.image;
    } else if (typeof item.image?.url === 'string') {
        imageUrl = item.image.url;
    } else if (item.mediaContent && item.mediaContent.length > 0) {
      const mediaImage = item.mediaContent.find((media) => media.$?.url && media.$?.medium === 'image');
      if (mediaImage?.$ && mediaImage.$.url) {
        imageUrl = mediaImage.$.url;
      }
    }
    // Add more extraction logic if needed for specific feeds

    const articleToInsert: InsertArticle = {
      sourceId: src.id,
      title: item.title,
      link: item.link,
      summary: item.contentSnippet?.substring(0, 1000) ?? null,
      published: (() => {
        if (!item.pubDate) return new Date();
        try {
          const d = parseISO(item.pubDate);
          return isNaN(d.valueOf()) ? new Date() : d;
        } catch {
          console.warn(`Failed to parse date ${item.pubDate} for ${item.title}, using current date.`);
          return new Date();
        }
      })(),
      imageUrl: imageUrl,
      bias: src.bias,
      // indexed will use its default value from the schema (0)
    };

    await db.insert(articles).values(articleToInsert);

    console.log(`+ [${src.name}] ${item.title}`);
  }
}

async function main() {
  const allSources = await db.select().from(sources);

  for (const src of allSources) {
    if (!src.rss) {
      console.warn(`Source "${src.name}" is missing an RSS feed URL. Skipping.`);
      continue;
    }
    try {
      await ingestOneFeed(src as Source); // Cast to Source if type from select isn't specific enough
    } catch (err: unknown) {
      console.error(`Feed failed for ${src.name} (${src.rss}):`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log("Ingestion process completed.");
}

main().catch((e) => {
  console.error("Ingest worker fatal:", e);
  process.exit(1);
});