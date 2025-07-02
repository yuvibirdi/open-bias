#!/usr/bin/env bun
/**
 * Check Articles Distribution and Run Grouper
 * -------------------------------------------
 * Check the actual distribution of articles and run grouper on available data
 */

import { db, articles, sources } from "@open-bias/db";
import { eq, isNull } from "drizzle-orm";
import { groupArticles } from "./src/grouper-optimized";

async function checkAndRunGrouper() {
  console.log("🔍 Checking article distribution...\n");

  try {
    // Get all sources with article counts
    const allSources = await db.select().from(sources);
    console.log(`📊 Total sources: ${allSources.length}`);
    
    const sourcesWithCounts = [];
    for (const source of allSources) {
      const sourceArticles = await db.select().from(articles).where(eq(articles.sourceId, source.id));
      if (sourceArticles.length > 0) {
        sourcesWithCounts.push({
          id: source.id,
          name: source.name,
          articleCount: sourceArticles.length
        });
      }
    }
    
    console.log("\n📰 Sources with articles:");
    sourcesWithCounts
      .sort((a, b) => b.articleCount - a.articleCount)
      .forEach(source => {
        console.log(`   ${source.name}: ${source.articleCount} articles`);
      });
    
    const totalArticles = sourcesWithCounts.reduce((sum, s) => sum + s.articleCount, 0);
    console.log(`\n📄 Total articles: ${totalArticles}`);
    
    // Check ungrouped articles
    const ungroupedArticles = await db
      .select()
      .from(articles)
      .where(isNull(articles.groupId));
    
    console.log(`🔄 Ungrouped articles: ${ungroupedArticles.length}`);
    
    if (ungroupedArticles.length < 10) {
      console.log("⚠️ Not enough articles for meaningful grouping test");
      return;
    }
    
    // Run grouper on actual data
    console.log("\n🚀 Running optimized grouper on available articles...");
    const startTime = Date.now();
    
    // Configure grouper with magic number
    await groupArticles({
      maxTotalArticles: Math.min(100, ungroupedArticles.length), // Magic number: limit to 100 articles
      maxArticlesPerSource: 10, // Max 10 per source for testing
      embeddingThreshold: 0.7,
      llmThreshold: 0.8,
      testMode: true,
      verbose: true
    });
    
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log("\n📊 Grouping Results:");
    console.log(`   Processing time: ${processingTime}s`);
    console.log("   ✅ Optimized grouper completed successfully!");
    
  } catch (error) {
    console.error("❌ Failed to check and run grouper:", error);
    throw error;
  }
}

checkAndRunGrouper().catch(error => {
  console.error("❌ Check and run failed:", error);
  process.exit(1);
});
