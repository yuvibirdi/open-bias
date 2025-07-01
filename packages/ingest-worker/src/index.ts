/**
 * Ingest‑Worker
 * -------------
 * 1. Reads every RSS feed stored in the `sources` table (expects `sources.bias` to be set)
 * 2. Parses the feed with rss‑parser
 * 3. Inserts new articles into the `articles` table (idempotent), including `imageUrl` and `bias`.
 * 4. Groups similar articles from different sources into story groups
 * 5. Updates coverage tracking for multi-source stories
 *
 * Run locally with:
 *    bun run packages/ingest-worker/src/index.ts
 * or in watch mode via workspace `dev` script.
 */

import Parser from "rss-parser";
import { db, sources, articles, articleGroups, storyCoverage, type Source, type InsertArticle } from "@open-bias/db";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { parseISO, subHours } from "date-fns";
import { TfIdf } from "natural";

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

    const articleToInsert = {
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

const GROUPING_SIMILARITY_THRESHOLD = 0.3;
const RECENT_HOURS = 48; // Look for similar articles within 48 hours

async function groupNewArticle(insertedId: any, title: string, summary?: string) {
  if (!summary || summary.length < 20) return;

  // Find recent articles (within 48 hours) that might be about the same story
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
    .limit(100); // Limit to prevent performance issues

  if (recentArticles.length === 0) return;

  // Use TF-IDF to find similar articles
  const tfidf = new TfIdf();
  const currentText = `${title} ${summary}`;
  
  // Add the current article first
  tfidf.addDocument(currentText);
  
  // Add recent articles
  const candidateArticles = recentArticles.filter(a => a.summary && a.summary.length > 20);
  for (const article of candidateArticles) {
    tfidf.addDocument(`${article.title} ${article.summary}`);
  }

  // Find the most similar article
  let bestMatch: typeof candidateArticles[0] | null = null;
  let bestSimilarity = 0;

  for (let i = 0; i < candidateArticles.length; i++) {
    const similarity = tfidf.tfidf(currentText, i + 1); // +1 because current article is at index 0
    if (similarity > bestSimilarity && similarity > GROUPING_SIMILARITY_THRESHOLD) {
      bestSimilarity = similarity;
      bestMatch = candidateArticles[i];
    }
  }

  if (bestMatch) {
    let groupId = bestMatch.groupId;
    
    // If the best match doesn't have a group, create one
    if (!groupId) {
      const groupResult = await db.insert(articleGroups).values({
        name: bestMatch.title.substring(0, 500), // Truncate to fit
        masterArticleId: bestMatch.id,
      });
      groupId = groupResult[0].insertId;
      
      // Update the best match article to be in this group
      await db.update(articles)
        .set({ groupId })
        .where(eq(articles.id, bestMatch.id));
    }

    // Add the new article to the group
    await db.update(articles)
      .set({ groupId })
      .where(eq(articles.id, insertedId));

    // Update coverage tracking
    await updateCoverageTracking(groupId);

    console.log(`  -> Grouped with existing story (similarity: ${bestSimilarity.toFixed(3)})`);
  }
}

async function updateCoverageTracking(groupId: number) {
  // Get all articles in this group with their bias information
  const groupArticles = await db
    .select({
      id: articles.id,
      bias: articles.bias,
      published: articles.published,
    })
    .from(articles)
    .where(eq(articles.groupId, groupId));

  const leftCount = groupArticles.filter(a => a.bias === 'left').length;
  const centerCount = groupArticles.filter(a => a.bias === 'center').length;
  const rightCount = groupArticles.filter(a => a.bias === 'right').length;
  const totalCount = groupArticles.length;

  // Calculate coverage score (0-100) based on how well represented different perspectives are
  const maxPossibleBalance = Math.min(leftCount + centerCount + rightCount, 3); // Perfect would be at least 1 from each
  const actualBalance = (leftCount > 0 ? 1 : 0) + (centerCount > 0 ? 1 : 0) + (rightCount > 0 ? 1 : 0);
  const coverageScore = (actualBalance / 3) * 100;

  const firstReported = groupArticles.reduce((earliest, article) => 
    !earliest || article.published < earliest ? article.published : earliest, 
    null as Date | null
  );

  // Upsert coverage tracking
  await db.insert(storyCoverage).values({
    groupId,
    leftCoverage: leftCount,
    centerCoverage: centerCount,
    rightCoverage: rightCount,
    totalCoverage: totalCount,
    coverageScore,
    firstReported,
  }).onDuplicateKeyUpdate({
    leftCoverage: leftCount,
    centerCoverage: centerCount,
    rightCoverage: rightCount,
    totalCoverage: totalCount,
    coverageScore,
    lastUpdated: new Date(),
  });
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