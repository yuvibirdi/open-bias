/**
 * Simple Ingest Worker
 * -------------------
 * Simplified ingestion that just fetches and stores articles.
 * All grouping, analysis, and enrichment happens in the enrich-worker.
 */

import Parser from "rss-parser";
import { db, sources, articles, type Source, type InsertArticle } from "@open-bias/db";
import { eq } from "drizzle-orm";
import { parseISO } from "date-fns";

// Simple configuration - just for basic ingestion
const INGEST_CONFIG = {
  MIN_TITLE_LENGTH: 5,        // Minimum title length for acceptance
  FETCH_INTERVAL: 30,         // Fetch every 30 minutes (for scheduler)
  REQUEST_TIMEOUT: 10000,     // 10 second timeout for RSS requests
};

// Enhanced RSS parser with better field extraction
const parser = new Parser<unknown, any>({
  timeout: INGEST_CONFIG.REQUEST_TIMEOUT,
  customFields: {
    item: [
      'enclosure',
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      'description',
      'content',
      'summary'
    ]
  }
});

/**
 * Simple feed ingestion - just fetch and store articles
 */
async function ingestOneFeed(src: Source) {
  if (!src.bias || src.bias === 'unknown') {
    console.warn(`[${src.name}] Source missing bias classification, skipping...`);
    return;
  }

  console.log(`📰 Processing feed: ${src.name} [${src.bias}]`);
  
  try {
    const feed = await parser.parseURL(src.rss);
    let processedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;

    for (const item of feed.items) {
      // Basic validation
      if (!item.link || !item.title || item.title.length < INGEST_CONFIG.MIN_TITLE_LENGTH) {
        rejectedCount++;
        continue;
      }

      // Check for duplicates
      const exists = await db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.link, item.link))
        .limit(1);

      if (exists.length) {
        duplicateCount++;
        continue;
      }

      // Extract image URL
      const imageUrl = extractImageUrl(item);
      
      // Parse date
      const publishedDate = parsePublishedDate(item.pubDate);
      
      // Clean summary
      const summary = cleanSummary(item.contentSnippet || item.description || item.summary);
      
      const articleToInsert: InsertArticle = {
        sourceId: src.id,
        title: item.title.trim(),
        link: item.link,
        summary,
        published: publishedDate,
        imageUrl,
        bias: src.bias,
        indexed: 0, // Will be set to 1 by enrich-worker after processing
      };

      await db.insert(articles).values(articleToInsert);
      
      processedCount++;
      console.log(`  ✅ [${src.name}] ${item.title.substring(0, 60)}...`);
    }

    console.log(`📊 [${src.name}] Processed: ${processedCount}, Duplicates: ${duplicateCount}, Rejected: ${rejectedCount}`);
    
    // Update source fetch timestamp
    await db.update(sources)
      .set({ fetchedAt: new Date() })
      .where(eq(sources.id, src.id));

  } catch (error) {
    console.error(`❌ [${src.name}] Feed processing failed:`, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Main simple ingestion process
 */
async function runSimpleIngestion() {
  console.log('🚀 Starting simple ingestion process...');
  
  const startTime = Date.now();
  
  try {
    // Get all active sources
    const allSources = await db.select().from(sources);
    console.log(`📋 Found ${allSources.length} sources to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const src of allSources) {
      if (!src.rss) {
        console.warn(`⚠️  Source "${src.name}" missing RSS URL, skipping...`);
        continue;
      }
      
      try {
        await ingestOneFeed(src as Source);
        successCount++;
      } catch (err) {
        console.error(`❌ Feed failed for ${src.name}:`, err instanceof Error ? err.message : String(err));
        errorCount++;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n📊 Simple ingestion completed in ${duration}s`);
    console.log(`   ✅ Successful: ${successCount} sources`);
    console.log(`   ❌ Failed: ${errorCount} sources`);
    console.log(`   💡 Run enrich-worker to group articles and perform analysis`);
    
  } catch (error) {
    console.error('💥 Simple ingestion process failed:', error);
    throw error;
  }
}

/**
 * Simple scheduler for frequent fetching
 */
class SimpleIngestScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMinutes: number = INGEST_CONFIG.FETCH_INTERVAL) {
    console.log(`⏰ Starting automated ingestion every ${intervalMinutes} minutes`);
    
    // Initial run
    this.runSafeIngestion();
    
    // Schedule regular ingestion
    this.intervalId = setInterval(() => {
      this.runSafeIngestion();
    }, intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('⏹️  Ingestion scheduler stopped');
  }

  private async runSafeIngestion() {
    try {
      await runSimpleIngestion();
    } catch (error) {
      console.error('⚠️  Scheduled ingestion failed:', error);
    }
  }
}

/**
 * Utility functions
 */
function extractImageUrl(item: any): string | null {
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }
  if (item.itunes?.image) return item.itunes.image;
  if (typeof item.image === 'string') return item.image;
  if (item.image?.url) return item.image.url;
  if (item.mediaThumbnail?.url) return item.mediaThumbnail.url;
  if (item.mediaContent?.[0]?.$?.url) return item.mediaContent[0].$.url;
  return null;
}

function parsePublishedDate(pubDate?: string): Date {
  if (!pubDate) return new Date();
  try {
    const parsed = parseISO(pubDate);
    return isNaN(parsed.valueOf()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
}

function cleanSummary(summary?: string): string | null {
  if (!summary) return null;
  return summary
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim()
    .substring(0, 1000);     // Limit length
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'once';

  if (mode === 'schedule' || mode === 'daemon') {
    const intervalMinutes = parseInt(args[1]) || INGEST_CONFIG.FETCH_INTERVAL;
    console.log('🤖 Starting in scheduled mode...');
    const scheduler = new SimpleIngestScheduler();
    scheduler.start(intervalMinutes);

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Graceful shutdown initiated...');
      scheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Graceful shutdown initiated...');
      scheduler.stop();
      process.exit(0);
    });

  } else {
    console.log('🏃 Running single ingestion...');
    await runSimpleIngestion();
    console.log('✨ Single ingestion completed!');
    process.exit(0);
  }
}

// Export for use by other modules
export { 
  runSimpleIngestion, 
  SimpleIngestScheduler, 
  INGEST_CONFIG
};

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Simple ingest worker fatal error:', error);
    process.exit(1);
  });
}
