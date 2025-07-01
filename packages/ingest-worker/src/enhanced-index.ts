/**
 * Enhanced Ingest‑Worker
 * ----------------------
 * 1. Reads every RSS feed stored in the `sources` table
 * 2. Parses the feed with rss‑parser
 * 3. Inserts new articles into the `articles` table
 * 4. Groups similar articles from different sources
 * 5. Updates coverage tracking for multi-source stories
 */

import Parser from "rss-parser";
import { db, sources, articles, articleGroups, type Source, type InsertArticle } from "@open-bias/db";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { parseISO, subHours } from "date-fns";

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
  image?: string | { url?: string };
  itunes?: { image?: string };
  media?: { content?: { $: { url?: string } }[] };
  mediaContent?: Array<{ $?: { url?: string; medium?: string } }>;
  [key: string]: unknown;
};

const parser = new Parser<unknown, RSSItem>({
  customFields: {
    item: [
      'enclosure',
      ['media:content', 'mediaContent', { keepArray: true }]
    ]
  }
});

const GROUPING_SIMILARITY_THRESHOLD = 0.3;
const RECENT_HOURS = 48;

async function ingestOneFeed(src: Source) {
  if (src.bias === null || typeof src.bias === 'undefined') {
    console.warn(`[${src.name}] Source is missing a bias value. Skipping.`);
    return;
  }

  const feed = await parser.parseURL(src.rss);

  for (const item of feed.items) {
    if (!item.link || !item.title) continue;

    // Check if article already exists
    const exists = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.link, item.link))
      .limit(1);

    if (exists.length) continue;

    // Extract image URL
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
    };

    try {
      const insertResult = await db.insert(articles).values(articleToInsert);
      const insertedId = insertResult[0]?.insertId;
      
      if (insertedId) {
        await groupNewArticle(Number(insertedId), item.title, item.contentSnippet);
      }

      console.log(`+ [${src.name}] ${item.title}`);
    } catch (error) {
      console.error(`Failed to insert article: ${error}`);
    }
  }
}

async function groupNewArticle(insertedId: number, title: string, summary?: string) {
  if (!summary || summary.length < 20) return;

  try {
    // Find recent articles that might be about the same story
    const recentCutoff = subHours(new Date(), RECENT_HOURS);
    
    const recentArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        sourceId: articles.sourceId,
        bias: articles.bias,
        groupId: articles.groupId,
      })
      .from(articles)
      .where(
        and(
          sql`${articles.published} >= ${recentCutoff}`,
          sql`${articles.id} != ${insertedId}`
        )
      )
      .orderBy(desc(articles.published))
      .limit(100);

    if (recentArticles.length === 0) return;

    // Simple text similarity matching using keyword overlap
    const currentText = `${title} ${summary}`.toLowerCase();
    const currentKeywords = extractKeywords(currentText);

    let bestMatch: typeof recentArticles[0] | null = null;
    let bestSimilarity = 0;

    for (const article of recentArticles) {
      if (!article.summary) continue;
      
      const articleText = `${article.title} ${article.summary}`.toLowerCase();
      const articleKeywords = extractKeywords(articleText);
      
      const similarity = calculateSimilarity(currentKeywords, articleKeywords);
      
      if (similarity > bestSimilarity && similarity > GROUPING_SIMILARITY_THRESHOLD) {
        bestSimilarity = similarity;
        bestMatch = article;
      }
    }

    if (bestMatch) {
      let groupId = bestMatch.groupId;
      
      // If the best match doesn't have a group, create one
      if (!groupId) {
        const groupResult = await db.insert(articleGroups).values({
          name: bestMatch.title.substring(0, 500),
          masterArticleId: bestMatch.id,
        });
        groupId = Number(groupResult[0]?.insertId);
        
        // Update the best match article to be in this group
        await db.update(articles)
          .set({ groupId })
          .where(eq(articles.id, bestMatch.id));
      }

      // Add the new article to the group
      await db.update(articles)
        .set({ groupId })
        .where(eq(articles.id, insertedId));

      console.log(`  -> Grouped with existing story (similarity: ${bestSimilarity.toFixed(3)})`);
    }
  } catch (error) {
    console.error(`Error in grouping: ${error}`);
  }
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - remove common words and extract meaningful terms
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
  
  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word))
    .slice(0, 20); // Take top 20 keywords
}

function calculateSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

async function main() {
  const allSources = await db.select().from(sources);

  for (const src of allSources) {
    if (!src.rss) {
      console.warn(`Source "${src.name}" is missing an RSS feed URL. Skipping.`);
      continue;
    }
    try {
      await ingestOneFeed(src as Source);
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
