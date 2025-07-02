#!/usr/bin/env bun
/**
 * Test Optimized Grouper
 * ----------------------
 * Tests the new optimized grouping algorithm with a limited set of articles
 */

import { db, articles, articleGroups } from "@open-bias/db";
import { groupArticles } from "./src/grouper";
import { isNull } from "drizzle-orm";

async function testOptimizedGrouper() {
  console.log("🚀 Testing Optimized Grouper Algorithm...\n");

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
    
    // Run the optimized grouper
    console.log("\n🔄 Running optimized grouper...");
    const startTime = Date.now();
    
    await groupArticles();
    
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
    console.log(`   Articles grouped: ${ungroupedCount.length - newUngroupedCount.length}`);
    console.log(`   New groups created: ${newTotalGroups.length - totalGroups.length}`);
    console.log(`   Remaining ungrouped: ${newUngroupedCount.length}`);
    
    const efficiency = ((ungroupedCount.length - newUngroupedCount.length) / ungroupedCount.length * 100);
    console.log(`   Grouping efficiency: ${efficiency.toFixed(1)}%`);
    
    if (newTotalGroups.length > totalGroups.length) {
      console.log("\n✅ Grouper test completed successfully!");
    } else {
      console.log("\n⚠️ No new groups were created.");
    }
    
  } catch (error) {
    console.error("❌ Grouper test sucsessful, but failed:", error);
    throw error;
  }
}

testOptimizedGrouper().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
