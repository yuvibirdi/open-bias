/**
 * Enhanced Ingest Worker v2
 * -------------------------
 * Features:
 * 1. Smarter story grouping with multiple similarity techniques
 * 2. Automated scheduling for frequent fetching
 * 3. Better duplicate detection and story validation
 * 4. Improved article matching with stricter thresholds
 * 5. Quality filtering to prevent poor groupings
 * 6. Story health monitoring and validation
 */

import Parser from "rss-parser";
import { db, sources, articles, articleGroups, storyCoverage, type Source, type InsertArticle } from "@open-bias/db";
import { eq, and, isNull, sql, desc, count, lt, gt } from "drizzle-orm";
import { parseISO, subHours, subDays } from "date-fns";
import { analyzeArticleSimilarity, testLLMConnection, validateModels, type ArticleContent } from "./llm-similarity";

// Enhanced configuration
const ENHANCED_CONFIG = {
  // Stricter grouping thresholds
  TF_IDF_THRESHOLD: 0.65,           // Increased from 0.3 to be much stricter
  TITLE_SIMILARITY_THRESHOLD: 0.75,  // Require high title similarity
  COMBINED_THRESHOLD: 0.7,           // Overall similarity requirement
  
  // Time windows
  RECENT_HOURS: 24,                  // Look for similar articles within 24 hours (reduced from 48)
  BATCH_SIZE: 50,                    // Process fewer articles per batch for better accuracy
  
  // Quality controls
  MIN_TITLE_LENGTH: 10,              // Minimum title length for grouping
  MIN_SUMMARY_LENGTH: 50,            // Minimum summary length for grouping
  MAX_GROUP_SIZE: 15,                // Maximum articles per group to prevent mega-groups
  MIN_WORD_OVERLAP: 3,               // Minimum word overlap for consideration
  MAX_ARTICLES_PER_SOURCE: 1,        // Hard limit: only 1 article per source per group
  
  // Fetch intervals (in minutes)
  FETCH_INTERVAL: 30,                // Fetch every 30 minutes
  CLEANUP_INTERVAL: 360,             // Cleanup every 6 hours
};

// Enhanced RSS parser with better field extraction
const parser = new Parser<unknown, any>({
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
 * Calculate enhanced article similarity using LLM analysis
 */
async function calculateSimilarityLLM(article1: ArticleContent, article2: ArticleContent): Promise<number> {
  try {
    const result = await analyzeArticleSimilarity(article1, article2);
    return result.similarity;
  } catch (error) {
    console.warn('LLM similarity failed, using fallback:', error);
    return calculateFallbackSimilarity(article1, article2);
  }
}

/**
 * Fallback similarity calculation (simple word overlap)
 */
function calculateFallbackSimilarity(article1: ArticleContent, article2: ArticleContent): number {
  const title1 = article1.title.toLowerCase();
  const title2 = article2.title.toLowerCase();
  
  // Simple word overlap for titles
  const words1 = new Set(title1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(title2.split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  const titleSimilarity = union.size > 0 ? intersection.size / union.size : 0;
  
  // Simple content overlap if summaries available
  let contentSimilarity = 0;
  if (article1.summary && article2.summary) {
    const content1 = new Set(article1.summary.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const content2 = new Set(article2.summary.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const contentIntersection = new Set([...content1].filter(w => content2.has(w)));
    const contentUnion = new Set([...content1, ...content2]);
    contentSimilarity = contentUnion.size > 0 ? contentIntersection.size / contentUnion.size : 0;
  }
  
  return (titleSimilarity * 0.6) + (contentSimilarity * 0.4);
}

/**
 * Enhanced feed ingestion with better quality control
 */
async function ingestOneFeedEnhanced(src: Source) {
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
      // Quality validation
      if (!item.link || !item.title || item.title.length < ENHANCED_CONFIG.MIN_TITLE_LENGTH) {
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

      // Extract better image URL
      const imageUrl = extractImageUrl(item);
      
      // Parse and validate date
      const publishedDate = parsePublishedDate(item.pubDate);
      
      // Clean and validate summary
      const summary = cleanSummary(item.contentSnippet || item.description || item.summary);
      
      const articleToInsert: InsertArticle = {
        sourceId: src.id,
        title: item.title.trim(),
        link: item.link,
        summary,
        published: publishedDate,
        imageUrl,
        bias: src.bias,
        indexed: 0,
      };

      const result = await db.insert(articles).values(articleToInsert);
      const insertedId = result[0].insertId;

      // Enhanced grouping logic
      await enhancedGroupArticle(insertedId, item.title, summary || undefined);
      
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
 * Enhanced article grouping with strict validation
 */
async function enhancedGroupArticle(insertedId: any, title: string, summary?: string) {
  if (!summary || summary.length < ENHANCED_CONFIG.MIN_SUMMARY_LENGTH) {
    console.log(`  ⚠️  Article too short for grouping: ${title.substring(0, 40)}...`);
    return;
  }

  // Get the source ID of the inserted article first
  const insertedArticle = await db
    .select({ sourceId: articles.sourceId })
    .from(articles)
    .where(eq(articles.id, insertedId))
    .limit(1);
  
  if (insertedArticle.length === 0) return;
  const currentSourceId = insertedArticle[0].sourceId;

  const recentCutoff = subHours(new Date(), ENHANCED_CONFIG.RECENT_HOURS);
  
  // Get recent articles that could potentially match
  const candidateArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      sourceId: articles.sourceId,
      bias: articles.bias,
      groupId: articles.groupId,
      published: articles.published,
    })
    .from(articles)
    .where(
      and(
        sql`${articles.published} >= ${recentCutoff}`,
        sql`${articles.id} != ${insertedId}`,
        sql`LENGTH(${articles.summary}) >= ${ENHANCED_CONFIG.MIN_SUMMARY_LENGTH}`,
        sql`${articles.sourceId} != ${currentSourceId}` // Exclude same source articles
      )
    )
    .orderBy(desc(articles.published))
    .limit(ENHANCED_CONFIG.BATCH_SIZE);

  if (candidateArticles.length === 0) return;

  // Find best matches using enhanced similarity
  const currentArticle = { title, summary };
  let bestMatch: typeof candidateArticles[0] | null = null;
  let bestSimilarity = 0;

  for (const candidate of candidateArticles) {
    if (!candidate.summary) continue;
    
    const candidateArticle = { title: candidate.title, summary: candidate.summary };
    const similarity = calculateFallbackSimilarity(currentArticle, candidateArticle);
    
    if (similarity > bestSimilarity && 
        similarity > ENHANCED_CONFIG.COMBINED_THRESHOLD) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  if (bestMatch) {
    let groupId = bestMatch.groupId;
    
    // Check if group is getting too large
    if (groupId) {
      const groupSize = await db
        .select({ count: count() })
        .from(articles)
        .where(eq(articles.groupId, groupId));
      
      if (groupSize[0].count >= ENHANCED_CONFIG.MAX_GROUP_SIZE) {
        console.log(`  ⚠️  Group ${groupId} too large (${groupSize[0].count} articles), creating new group`);
        groupId = null;
      } else {
        // Check if this source already has an article in the group (HARD LIMIT: 1 per source)
        const sourceAlreadyInGroup = await db
          .select({ count: count() })
          .from(articles)
          .where(and(
            eq(articles.groupId, groupId),
            eq(articles.sourceId, currentSourceId)
          ));
        
        if (sourceAlreadyInGroup[0].count > 0) {
          console.log(`  🚫 Source ${currentSourceId} already has an article in group ${groupId}, creating new group`);
          groupId = null;
        }
      }
    }
    
    // Create new group if needed
    if (!groupId) {
      const groupResult = await db.insert(articleGroups).values({
        name: bestMatch.title.substring(0, 500),
        masterArticleId: bestMatch.id,
      });
      groupId = groupResult[0].insertId;
      
      // Update the best match article
      await db.update(articles)
        .set({ groupId })
        .where(eq(articles.id, bestMatch.id));
    }

    // Add the new article to the group
    await db.update(articles)
      .set({ groupId })
      .where(eq(articles.id, insertedId));

    // Update coverage tracking
    await updateEnhancedCoverageTracking(groupId);

    console.log(`  🔗 Grouped with story (similarity: ${bestSimilarity.toFixed(3)}, group: ${groupId})`);
  } else {
    console.log(`  🆕 No matching story found (best similarity: ${bestSimilarity.toFixed(3)})`);
  }
}

/**
 * Enhanced coverage tracking with quality metrics
 */
async function updateEnhancedCoverageTracking(groupId: number) {
  const groupArticles = await db
    .select({
      id: articles.id,
      bias: articles.bias,
      published: articles.published,
      sourceId: articles.sourceId,
    })
    .from(articles)
    .where(eq(articles.groupId, groupId));

  // Count by bias and ensure source diversity
  const leftCount = groupArticles.filter(a => a.bias === 'left').length;
  const centerCount = groupArticles.filter(a => a.bias === 'center').length;
  const rightCount = groupArticles.filter(a => a.bias === 'right').length;
  const totalCount = groupArticles.length;
  
  // Check source diversity
  const uniqueSources = new Set(groupArticles.map(a => a.sourceId)).size;
  const sourceDiversityScore = Math.min(uniqueSources / totalCount, 1) * 100;

  // Calculate coverage score with bias balance and source diversity
  const biasBalance = (leftCount > 0 ? 1 : 0) + (centerCount > 0 ? 1 : 0) + (rightCount > 0 ? 1 : 0);
  const biasScore = (biasBalance / 3) * 100;
  const coverageScore = (biasScore * 0.7) + (sourceDiversityScore * 0.3);

  const firstReported = groupArticles.reduce((earliest, article) => 
    !earliest || article.published < earliest ? article.published : earliest, 
    null as Date | null
  );

  await db.insert(storyCoverage).values({
    groupId,
    leftCoverage: leftCount,
    centerCoverage: centerCount,
    rightCoverage: rightCount,
    totalCoverage: totalCount,
    coverageScore: coverageScore.toString(),
    firstReported,
  });
}

/**
 * Cleanup unhealthy story groups
 */
async function cleanupUnhealthyGroups() {
  console.log('🧹 Starting cleanup of unhealthy story groups...');
  
  // Find groups with only one article (orphaned groups)
  const orphanedGroups = await db
    .select({ groupId: articles.groupId, count: count() })
    .from(articles)
    .where(sql`${articles.groupId} IS NOT NULL`)
    .groupBy(articles.groupId)
    .having(sql`COUNT(*) = 1`);

  for (const group of orphanedGroups) {
    if (group.groupId) {
      await db.update(articles)
        .set({ groupId: null })
        .where(eq(articles.groupId, group.groupId));
      
      await db.delete(articleGroups).where(eq(articleGroups.id, group.groupId));
      console.log(`  🗑️  Removed orphaned group ${group.groupId}`);
    }
  }

  // Find mega-groups (groups with too many articles from same source)
  const megaGroups = await db
    .select({ 
      groupId: articles.groupId, 
      sourceId: articles.sourceId,
      count: count() 
    })
    .from(articles)
    .where(sql`${articles.groupId} IS NOT NULL`)
    .groupBy(articles.groupId, articles.sourceId)
    .having(sql`COUNT(*) > 5`); // More than 5 articles from same source in a group

  for (const group of megaGroups) {
    if (group.groupId) {
      console.log(`  ⚠️  Found mega-group ${group.groupId} with ${group.count} articles from source ${group.sourceId}`);
      // This could be enhanced to split the group or mark for review
    }
  }

  console.log('✅ Cleanup completed');
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

/**
 * Main enhanced ingestion process
 */
async function runEnhancedIngestion() {
  console.log('🚀 Starting enhanced ingestion process...');
  
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
        await ingestOneFeedEnhanced(src as Source);
        successCount++;
      } catch (err) {
        console.error(`❌ Feed failed for ${src.name}:`, err instanceof Error ? err.message : String(err));
        errorCount++;
      }
    }

    // Cleanup unhealthy groups
    await cleanupUnhealthyGroups();

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n📊 Enhanced ingestion completed in ${duration}s`);
    console.log(`   ✅ Successful: ${successCount} sources`);
    console.log(`   ❌ Failed: ${errorCount} sources`);
    
  } catch (error) {
    console.error('💥 Enhanced ingestion process failed:', error);
    throw error;
  }
}

/**
 * Automated scheduler for frequent fetching
 */
class IngestScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  start() {
    console.log(`⏰ Starting automated ingestion every ${ENHANCED_CONFIG.FETCH_INTERVAL} minutes`);
    
    // Initial run
    this.runSafeIngestion();
    
    // Schedule regular ingestion
    this.intervalId = setInterval(() => {
      this.runSafeIngestion();
    }, ENHANCED_CONFIG.FETCH_INTERVAL * 60 * 1000);

    // Schedule periodic cleanup
    this.cleanupIntervalId = setInterval(() => {
      this.runSafeCleanup();
    }, ENHANCED_CONFIG.CLEANUP_INTERVAL * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    console.log('⏹️  Ingestion scheduler stopped');
  }

  private async runSafeIngestion() {
    try {
      await runEnhancedIngestion();
    } catch (error) {
      console.error('⚠️  Scheduled ingestion failed:', error);
    }
  }

  private async runSafeCleanup() {
    try {
      await cleanupUnhealthyGroups();
    } catch (error) {
      console.error('⚠️  Scheduled cleanup failed:', error);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'once';

  if (mode === 'schedule' || mode === 'daemon') {
    console.log('🤖 Starting in scheduled mode...');
    const scheduler = new IngestScheduler();
    scheduler.start();

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
    await runEnhancedIngestion();
    console.log('✨ Single ingestion completed!');
    process.exit(0);
  }
}

// Export for use by other modules
export { 
  runEnhancedIngestion, 
  IngestScheduler, 
  ENHANCED_CONFIG,
  cleanupUnhealthyGroups 
};

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Enhanced ingest worker fatal error:', error);
    process.exit(1);
  });
}
