#!/usr/bin/env bun
/**
 * Reset All Article Groupings
 * ---------------------------
 * Manually ungroups all articles by setting groupId to null
 * and removes all article groups from the database
 */

import { db, articles, articleGroups } from "@open-bias/db";
import { isNotNull, sql } from "drizzle-orm";

async function resetAllGroupings() {
  console.log("🔄 Resetting all article groupings...\n");

  try {
    // First, check current state
    const groupedArticles = await db
      .select()
      .from(articles)
      .where(isNotNull(articles.groupId));
    
    const totalGroups = await db.select().from(articleGroups);
    
    console.log(`📊 Current state:`);
    console.log(`   Grouped articles: ${groupedArticles.length}`);
    console.log(`   Total groups: ${totalGroups.length}`);
    
    if (groupedArticles.length === 0 && totalGroups.length === 0) {
      console.log("✅ All articles are already ungrouped and no groups exist!");
      return;
    }
    
    // Reset all article groupIds to null
    if (groupedArticles.length > 0) {
      console.log("\n🔄 Ungrouping all articles...");
      const result = await db
        .update(articles)
        .set({ groupId: null })
        .where(isNotNull(articles.groupId));
      
      console.log(`✅ Ungrouped ${groupedArticles.length} articles`);
    }
    
    // Delete all article groups
    if (totalGroups.length > 0) {
      console.log("🔄 Deleting all article groups...");
      await db.delete(articleGroups);
      console.log(`✅ Deleted ${totalGroups.length} groups`);
    }
    
    // Verify the reset
    const remainingGrouped = await db
      .select()
      .from(articles)
      .where(isNotNull(articles.groupId));
    
    const remainingGroups = await db.select().from(articleGroups);
    
    console.log(`\n📊 Final state:`);
    console.log(`   Grouped articles: ${remainingGrouped.length}`);
    console.log(`   Total groups: ${remainingGroups.length}`);
    
    if (remainingGrouped.length === 0 && remainingGroups.length === 0) {
      console.log("\n✅ All groupings have been successfully reset!");
      console.log("🎯 Database is now ready for fresh grouping tests.");
    } else {
      console.log("\n⚠️ Some groupings may still exist - check manually");
    }
    
  } catch (error) {
    console.error("❌ Failed to reset groupings:", error);
    throw error;
  }
}

resetAllGroupings().catch(error => {
  console.error("❌ Reset failed:", error);
  process.exit(1);
});
