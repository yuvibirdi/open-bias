#!/usr/bin/env bun
/**
 * Test Optimized Grouper - Small Batch
 * ------------------------------------
 * Tests the new optimized grouping algorithm with a very small set of articles
 */

import { db, articles, articleGroups } from "@open-bias/db";
import { groupArticles } from "./src/grouper-optimized";
import { isNull } from "drizzle-orm";

async function testOptimizedGrouperSmall() {
  console.log("🚀 Testing Optimized Grouper Algorithm (Small Batch)...\n");

  try {
    // Check current state
    const ungroupedCount = await db
      .select()
      .from(articles)
      .where(isNull(articles.groupId));
    
    const totalGroups = await db.select().from(articleGroups);
    
    console.log(`📊 Current state:`);
    console.log(`   Ungrouped articles: ${ungroupedCount.length}`);
    console.log(`   Existing groups: ${totalGroups.length}`);
    
    if (ungroupedCount.length === 0) {
      console.log("✅ All articles are already grouped!");
      return;
    }
    
    // Run the optimized grouper in test mode (50 articles max)
    console.log("\n🔄 Running optimized grouper (test mode - 50 articles max)...");
    const startTime = Date.now();
    
    await groupArticles(true); // Test mode
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Check results
    const newUngroupedCount = await db
      .select()
      .from(articles)
      .where(isNull(articles.groupId));
    
    const newTotalGroups = await db.select().from(articleGroups);
    
    console.log(`\n📊 Results:`);
    console.log(`   Processing time: ${duration.toFixed(2)} seconds`);
    console.log(`   Articles processed: ~50 (test mode)`);
    console.log(`   Articles grouped: ${ungroupedCount.length - newUngroupedCount.length}`);
    console.log(`   New groups created: ${newTotalGroups.length - totalGroups.length}`);
    console.log(`   Remaining ungrouped: ${newUngroupedCount.length}`);
    
    const efficiency = ((ungroupedCount.length - newUngroupedCount.length) / Math.min(50, ungroupedCount.length) * 100);
    console.log(`   Grouping efficiency: ${efficiency.toFixed(1)}%`);
    console.log(`   Processing speed: ${(50 / duration).toFixed(1)} articles/second`);
    
    if (newTotalGroups.length > totalGroups.length) {
      console.log("\n✅ Optimized grouper test completed successfully!");
      console.log("🎯 System is working efficiently for small batches.");
      
      // Show created groups
      const newGroups = await db.query.articleGroups.findMany({
        where: (articleGroups, { gt }) => gt(articleGroups.id, totalGroups.length > 0 ? totalGroups[totalGroups.length - 1].id : 0)
      });
      
      for (const group of newGroups) {
        const groupArticles = await db.query.articles.findMany({
          where: (articles, { eq }) => eq(articles.groupId, group.id)
        });
        
        console.log(`\n📰 Group: "${group.name?.substring(0, 60)}..."`);
        console.log(`   Articles: ${groupArticles.length}`);
        groupArticles.forEach((article, i) => {
          console.log(`   ${i + 1}. ${article.title.substring(0, 50)}... (Source: ${article.sourceId})`);
        });
      }
      
    } else {
      console.log("\n⚠️ No new groups were created. This could mean:");
      console.log("   • Articles are too dissimilar");
      console.log("   • All similar articles are already grouped");
      console.log("   • Similarity thresholds need adjustment");
    }
    
  } catch (error) {
    console.error("❌ Optimized grouper test failed:", error);
    throw error;
  }
}

testOptimizedGrouperSmall().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
