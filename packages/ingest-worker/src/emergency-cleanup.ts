/**
 * Emergency Cleanup Script for Mega-Groups
 * ----------------------------------------
 * This script addresses the legacy mega-group problem where hundreds
 * of articles are incorrectly grouped together.
 */

import { db, articles, articleGroups, storyCoverage } from '@open-bias/db';
import { eq, gt, count, sql, and, isNull, inArray } from 'drizzle-orm';

const EMERGENCY_CONFIG = {
  MAX_GROUP_SIZE: 15,           // Maximum articles per group
  MIN_SIMILARITY_FOR_LARGE_GROUPS: 0.8,  // Higher bar for larger groups
  SOURCES_PER_GROUP_LIMIT: 8,   // Max sources per group
  MAX_ARTICLES_PER_SOURCE: 1,   // Hard limit: only 1 article per source per group
  CLEANUP_BATCH_SIZE: 100,      // Process in batches
};

/**
 * Find and break up mega-groups
 */
async function emergencyMegaGroupCleanup() {
  console.log('🚨 Starting emergency mega-group cleanup...');
  
  // Find all groups with too many articles
  const megaGroups = await db
    .select({
      groupId: articles.groupId,
      articleCount: count(),
      uniqueSources: sql<number>`COUNT(DISTINCT ${articles.sourceId})`,
    })
    .from(articles)
    .where(sql`${articles.groupId} IS NOT NULL`)
    .groupBy(articles.groupId)
    .having(gt(count(), EMERGENCY_CONFIG.MAX_GROUP_SIZE));

  console.log(`Found ${megaGroups.length} mega-groups to clean up:`);
  
  for (const group of megaGroups) {
    if (!group.groupId) continue;
    
    console.log(`\n🔧 Processing mega-group ${group.groupId}: ${group.articleCount} articles from ${group.uniqueSources} sources`);
    
    if (group.articleCount > 100) {
      // For very large groups, just dissolve them completely
      console.log(`   💥 Dissolving mega-group (too large): ${group.articleCount} articles`);
      await dissolveGroup(group.groupId);
    } else {
      // For medium groups, try to split intelligently
      console.log(`   ✂️  Attempting to split group into smaller pieces`);
      await splitGroup(group.groupId);
    }
  }
  
  console.log('\n✅ Emergency cleanup completed!');
}

/**
 * Completely dissolve a group - ungroup all articles
 */
async function dissolveGroup(groupId: number) {
  try {
    // Ungroup all articles
    await db.update(articles)
      .set({ groupId: null })
      .where(eq(articles.groupId, groupId));
    
    // Delete the group metadata
    await db.delete(articleGroups).where(eq(articleGroups.id, groupId));
    await db.delete(storyCoverage).where(eq(storyCoverage.groupId, groupId));
    
    console.log(`     ✅ Dissolved group ${groupId}`);
  } catch (error) {
    console.error(`     ❌ Failed to dissolve group ${groupId}:`, error);
  }
}

/**
 * Split a group into smaller, more reasonable groups
 */
async function splitGroup(groupId: number) {
  try {
    // Get all articles in the group
    const groupArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        sourceId: articles.sourceId,
        published: articles.published,
        bias: articles.bias,
      })
      .from(articles)
      .where(eq(articles.groupId, groupId))
      .orderBy(articles.published);

    if (groupArticles.length <= EMERGENCY_CONFIG.MAX_GROUP_SIZE) {
      console.log(`     ✅ Group ${groupId} is already acceptable size (${groupArticles.length})`);
      return;
    }

    // Strategy 1: Group by time windows (articles close in time are more likely related)
    const timeBasedGroups = groupByTimeWindow(groupArticles, 12); // 12-hour windows
    
    // Strategy 2: Ensure source diversity within each group
    const refinedGroups = ensureSourceDiversity(timeBasedGroups);
    
    // Strategy 3: Limit group sizes
    const finalGroups = limitGroupSizes(refinedGroups, EMERGENCY_CONFIG.MAX_GROUP_SIZE);
    
    if (finalGroups.length <= 1) {
      console.log(`     ⚠️  Cannot split group ${groupId} effectively, dissolving instead`);
      await dissolveGroup(groupId);
      return;
    }
    
    console.log(`     📊 Splitting into ${finalGroups.length} smaller groups`);
    
    // Create new groups and reassign articles
    for (let i = 0; i < finalGroups.length; i++) {
      const articleGroup = finalGroups[i];
      
      if (articleGroup.length === 0) continue;
      
      if (i === 0) {
        // Keep the first group with the original ID
        console.log(`     ➡️  Keeping group ${groupId} with ${articleGroup.length} articles`);
        
        // Remove articles not in this group
        const keepIds = articleGroup.map(a => a.id);
        await db.update(articles)
          .set({ groupId: null })
          .where(and(
            eq(articles.groupId, groupId),
            sql`${articles.id} NOT IN (${keepIds.join(',')})`
          ));
          
      } else {
        // Create a new group
        const newGroupResult = await db.insert(articleGroups).values({
          name: articleGroup[0].title.substring(0, 500),
          masterArticleId: articleGroup[0].id,
        });
        
        const newGroupId = newGroupResult[0].insertId;
        console.log(`     ➡️  Created group ${newGroupId} with ${articleGroup.length} articles`);
        
        // Assign articles to new group
        const articleIds = articleGroup.map(a => a.id);
        await db.update(articles)
          .set({ groupId: newGroupId })
          .where(sql`${articles.id} IN (${articleIds.join(',')})`);
      }
    }
    
    // Update coverage tracking for all affected groups
    const allGroupIds = [groupId, ...finalGroups.slice(1).map((_, i) => groupId + i + 1000)]; // Approximate new IDs
    for (const gid of allGroupIds) {
      await updateGroupCoverage(gid);
    }
    
  } catch (error) {
    console.error(`     ❌ Failed to split group ${groupId}:`, error);
  }
}

/**
 * Group articles by time windows
 */
function groupByTimeWindow(articles: any[], hoursWindow: number): any[][] {
  articles.sort((a, b) => new Date(a.published).getTime() - new Date(b.published).getTime());
  
  const groups: any[][] = [];
  let currentGroup: any[] = [];
  let windowStart: Date | null = null;
  
  for (const article of articles) {
    const articleTime = new Date(article.published);
    
    if (!windowStart || articleTime.getTime() - windowStart.getTime() > hoursWindow * 60 * 60 * 1000) {
      // Start new group
      if (currentGroup.length > 0) {
        groups.push([...currentGroup]);
      }
      currentGroup = [article];
      windowStart = articleTime;
    } else {
      // Add to current group
      currentGroup.push(article);
    }
  }
  
  // Add final group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Ensure groups have good source diversity and enforce 1 article per source rule
 */
function ensureSourceDiversity(groups: any[][]): any[][] {
  return groups.map(group => {
    // Enforce hard limit: only 1 article per source per group
    const sourceGroups = new Map<number, any[]>();
    
    for (const article of group) {
      const sourceId = article.sourceId;
      if (!sourceGroups.has(sourceId)) {
        sourceGroups.set(sourceId, []);
      }
      sourceGroups.get(sourceId)!.push(article);
    }
    
    // Take only 1 article per source (most recent)
    let result: any[] = [];
    for (const [sourceId, articles] of sourceGroups) {
      if (articles.length === 1) {
        result.push(articles[0]);
      } else {
        // Take the most recent article from this source
        const sorted = articles.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
        result.push(sorted[0]);
        console.log(`     📌 Enforcing 1-per-source rule: keeping most recent from source ${sourceId} (${articles.length} -> 1)`);
      }
    }
    
    return result;
  });
}

/**
 * Limit group sizes by splitting large groups
 */
function limitGroupSizes(groups: any[][], maxSize: number): any[][] {
  const result: any[][] = [];
  
  for (const group of groups) {
    if (group.length <= maxSize) {
      result.push(group);
    } else {
      // Split large group into chunks
      for (let i = 0; i < group.length; i += maxSize) {
        result.push(group.slice(i, i + maxSize));
      }
    }
  }
  
  return result.filter(group => group.length > 0);
}

/**
 * Update coverage tracking for a group
 */
async function updateGroupCoverage(groupId: number) {
  try {
    const groupArticles = await db
      .select({
        bias: articles.bias,
        sourceId: articles.sourceId,
        published: articles.published,
      })
      .from(articles)
      .where(eq(articles.groupId, groupId));

    if (groupArticles.length === 0) return;

    const leftCount = groupArticles.filter(a => a.bias === 'left').length;
    const centerCount = groupArticles.filter(a => a.bias === 'center').length;
    const rightCount = groupArticles.filter(a => a.bias === 'right').length;
    const totalCount = groupArticles.length;
    
    const uniqueSources = new Set(groupArticles.map(a => a.sourceId)).size;
    const sourceDiversityScore = Math.min(uniqueSources / totalCount, 1) * 100;
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
      coverageScore: Math.round(coverageScore).toString(),
      firstReported,
    });
  } catch (error) {
    console.error(`Failed to update coverage for group ${groupId}:`, error);
  }
}

/**
 * Enforce source diversity rule across all groups
 */
async function enforceSourceDiversityAllGroups() {
  console.log('🔧 Enforcing 1-article-per-source rule across all groups...');
  
  // Get all groups that have multiple articles from the same source
  const problematicGroups = await db
    .select({
      groupId: articles.groupId,
      sourceId: articles.sourceId,
      articleCount: count(),
    })
    .from(articles)
    .where(sql`${articles.groupId} IS NOT NULL`)
    .groupBy(articles.groupId, articles.sourceId)
    .having(gt(count(), 1));
  
  console.log(`Found ${problematicGroups.length} source violations to fix`);
  
  // Group by groupId to process each group
  const groupMap = new Map<number, typeof problematicGroups>();
  for (const violation of problematicGroups) {
    if (!violation.groupId) continue;
    if (!groupMap.has(violation.groupId)) {
      groupMap.set(violation.groupId, []);
    }
    groupMap.get(violation.groupId)!.push(violation);
  }
  
  for (const [groupId, violations] of groupMap) {
    console.log(`\n🔧 Processing group ${groupId} with ${violations.length} source violations`);
    
    for (const violation of violations) {
      if (!violation.sourceId) continue;
      
      console.log(`   📌 Source ${violation.sourceId} has ${violation.articleCount} articles, keeping most recent`);
      
      // Get all articles from this source in this group
      const duplicateArticles = await db
        .select({
          id: articles.id,
          title: articles.title,
          published: articles.published,
        })
        .from(articles)
        .where(and(
          eq(articles.groupId, groupId),
          eq(articles.sourceId, violation.sourceId)
        ))
        .orderBy(sql`${articles.published} DESC`);
      
      if (duplicateArticles.length <= 1) continue;
      
      // Keep the most recent one, ungroup the rest
      const toKeep = duplicateArticles[0];
      const toUngroup = duplicateArticles.slice(1);
      
      console.log(`      ✅ Keeping: "${toKeep.title}"`);
      for (const article of toUngroup) {
        console.log(`      ❌ Ungrouping: "${article.title}"`);
      }
      
      // Ungroup the older articles
      const idsToUngroup = toUngroup.map(a => a.id);
      await db.update(articles)
        .set({ groupId: null })
        .where(inArray(articles.id, idsToUngroup));
    }
    
    // Update coverage tracking for this group
    await updateGroupCoverage(groupId);
  }
  
  console.log('✅ Source diversity enforcement completed!');
}

/**
 * Main cleanup function
 */
async function main() {
  try {
    await emergencyMegaGroupCleanup();
    await enforceSourceDiversityAllGroups();
    
    console.log('\n📊 Final status:');
    
    // Get updated stats
    const groupStats = await db
      .select({
        groupId: articles.groupId,
        articleCount: count(),
      })
      .from(articles)
      .where(sql`${articles.groupId} IS NOT NULL`)
      .groupBy(articles.groupId)
      .orderBy(sql`COUNT(*) DESC`);
    
    console.log(`   📈 Active groups: ${groupStats.length}`);
    if (groupStats.length > 0) {
      console.log(`   📊 Largest group: ${groupStats[0].articleCount} articles`);
      console.log(`   📊 Average group size: ${Math.round(groupStats.reduce((sum, g) => sum + g.articleCount, 0) / groupStats.length)} articles`);
    }
    
    const totalArticles = await db.select({ count: count() }).from(articles);
    const groupedArticles = await db.select({ count: count() }).from(articles).where(sql`${articles.groupId} IS NOT NULL`);
    
    console.log(`   📄 Total articles: ${totalArticles[0].count}`);
    console.log(`   🔗 Grouped articles: ${groupedArticles[0].count}`);
    console.log(`   🆕 Ungrouped articles: ${totalArticles[0].count - groupedArticles[0].count}`);
    
  } catch (error) {
    console.error('💥 Emergency cleanup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✨ Emergency cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error during emergency cleanup:', error);
      process.exit(1);
    });
}

export { emergencyMegaGroupCleanup, EMERGENCY_CONFIG };
