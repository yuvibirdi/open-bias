#!/usr/bin/env bun

/**
 * Story Ingestion Management CLI
 * ------------------------------
 * This script provides commands to manage the enhanced story ingestion system:
 * - Seed expanded news sources
 * - Run enhanced ingestion (single or scheduled)
 * - Run grouping and analysis via enrich-worker
 * - Monitor system health
 */

import { Command } from 'commander';
import { seedExpandedSources } from '@open-bias/db';
import { 
  runEnhancedIngestion, 
  IngestScheduler, 
  cleanupUnhealthyGroups,
  ENHANCED_CONFIG 
} from './src/enhanced-ingest';
import { db, sources, articles, articleGroups, storyCoverage } from '@open-bias/db';
import { count, sql, desc, eq } from 'drizzle-orm';
import { spawn } from 'child_process';
import path from 'path';

const program = new Command();

program
  .name('ingest-manager')
  .description('Enhanced story ingestion management CLI')
  .version('2.0.0');

// Seed expanded sources
program
  .command('seed-sources')
  .description('Seed the database with expanded news sources (40+ sources)')
  .action(async () => {
    try {
      console.log('🌱 Seeding expanded news sources...');
      await seedExpandedSources();
      console.log('✅ Expanded sources seeded successfully!');
    } catch (error) {
      console.error('❌ Failed to seed sources:', error);
      process.exit(1);
    }
  });

// Run single ingestion
program
  .command('ingest')
  .description('Run a single enhanced ingestion cycle')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log('🚀 Starting enhanced ingestion with verbose logging...');
      }
      await runEnhancedIngestion();
      console.log('✅ Enhanced ingestion completed successfully!');
    } catch (error) {
      console.error('❌ Ingestion failed:', error);
      process.exit(1);
    }
  });

// Run grouping and analysis via enrich-worker
program
  .command('enrich')
  .description('Run article grouping and analysis via enrich-worker')
  .option('-m, --max-articles <number>', 'Maximum articles to process (-1 for all)', '-1')
  .option('-s, --max-per-source <number>', 'Maximum articles per source', '50')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log('🧠 Starting enrichment (grouping and analysis)...');
      
      const enrichWorkerPath = path.join(process.cwd(), '..', 'enrich-worker', 'src', 'index.ts');
      
      const enrichProcess = spawn('bun', [enrichWorkerPath], {
        stdio: 'inherit',
        cwd: path.join(process.cwd(), '..', 'enrich-worker')
      });

      enrichProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Enrichment completed successfully!');
        } else {
          console.error(`❌ Enrichment failed with code ${code}`);
          process.exit(1);
        }
      });

      enrichProcess.on('error', (error) => {
        console.error('❌ Failed to start enrichment process:', error);
        process.exit(1);
      });

    } catch (error) {
      console.error('❌ Enrichment failed:', error);
      process.exit(1);
    }
  });

// Run full pipeline: ingest + enrich
program
  .command('full')
  .description('Run full pipeline: ingestion followed by enrichment')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      console.log('🚀 Starting full pipeline...');
      
      // Step 1: Ingestion
      console.log('\n📥 Step 1: Enhanced Ingestion');
      await runEnhancedIngestion();
      console.log('✅ Ingestion completed');
      
      // Step 2: Enrichment
      console.log('\n🧠 Step 2: Enrichment (Grouping & Analysis)');
      const enrichWorkerPath = path.join(process.cwd(), '..', 'enrich-worker', 'src', 'index.ts');
      
      await new Promise<void>((resolve, reject) => {
        const enrichProcess = spawn('bun', [enrichWorkerPath], {
          stdio: 'inherit',
          cwd: path.join(process.cwd(), '..', 'enrich-worker')
        });

        enrichProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Enrichment completed');
            resolve();
          } else {
            reject(new Error(`Enrichment failed with code ${code}`));
          }
        });

        enrichProcess.on('error', (error) => {
          reject(error);
        });
      });
      
      console.log('\n🎉 Full pipeline completed successfully!');
      
    } catch (error) {
      console.error('❌ Full pipeline failed:', error);
      process.exit(1);
    }
  });

// Start scheduled ingestion
program
  .command('schedule')
  .description('Start the automated ingestion scheduler')
  .option('-i, --interval <minutes>', 'Fetch interval in minutes', '30')
  .action(async (options) => {
    const interval = parseInt(options.interval);
    if (isNaN(interval) || interval < 5) {
      console.error('❌ Invalid interval. Must be at least 5 minutes.');
      process.exit(1);
    }

    console.log(`⏰ Starting scheduled ingestion every ${interval} minutes...`);
    
    // Update config
    (ENHANCED_CONFIG as any).FETCH_INTERVAL = interval;
    
    const scheduler = new IngestScheduler();
    scheduler.start();

    // Handle graceful shutdown
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

    // Keep the process running
    await new Promise(() => {});
  });

// Cleanup unhealthy groups
program
  .command('cleanup')
  .description('Clean up unhealthy story groups')
  .action(async () => {
    try {
      console.log('🧹 Starting cleanup...');
      await cleanupUnhealthyGroups();
      console.log('✅ Cleanup completed successfully!');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

// System status and health check
program
  .command('status')
  .description('Display system status and health metrics')
  .action(async () => {
    try {
      console.log('📊 System Status Report');
      console.log('=' .repeat(50));

      // Source counts
      const totalSources = await db.select({ count: count() }).from(sources);
      const sourcesByBias = await db
        .select({ bias: sources.bias, count: count() })
        .from(sources)
        .groupBy(sources.bias);

      console.log('\n📰 News Sources:');
      console.log(`   Total: ${totalSources[0].count}`);
      sourcesByBias.forEach(s => {
        console.log(`   ${s.bias}: ${s.count}`);
      });

      // Article counts
      const totalArticles = await db.select({ count: count() }).from(articles);
      const recentArticles = await db
        .select({ count: count() })
        .from(articles)
        .where(sql`${articles.published} >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`);

      console.log('\n📄 Articles:');
      console.log(`   Total: ${totalArticles[0].count}`);
      console.log(`   Last 24h: ${recentArticles[0].count}`);

      // Story group stats
      const totalGroups = await db.select({ count: count() }).from(articleGroups);
      const groupedArticles = await db
        .select({ count: count() })
        .from(articles)
        .where(sql`${articles.groupId} IS NOT NULL`);

      console.log('\n🔗 Story Groups:');
      console.log(`   Total groups: ${totalGroups[0].count}`);
      console.log(`   Grouped articles: ${groupedArticles[0].count}`);
      console.log(`   Ungrouped articles: ${totalArticles[0].count - groupedArticles[0].count}`);

      // Coverage quality
      const coverageStats = await db
        .select({
          avgCoverage: sql<number>`AVG(CAST(${storyCoverage.coverageScore} AS DECIMAL))`,
          goodCoverage: sql<number>`SUM(CASE WHEN CAST(${storyCoverage.coverageScore} AS DECIMAL) >= 70 THEN 1 ELSE 0 END)`,
        })
        .from(storyCoverage);

      if (coverageStats[0]) {
        console.log('\n📈 Coverage Quality:');
        console.log(`   Avg coverage score: ${coverageStats[0].avgCoverage?.toFixed(1) || 'N/A'}%`);
        console.log(`   High-quality stories: ${coverageStats[0].goodCoverage || 0}`);
      }

      // Recent activity
      const recentGroups = await db
        .select({
          id: articleGroups.id,
          name: articleGroups.name,
          articleCount: count(articles.id),
        })
        .from(articleGroups)
        .leftJoin(articles, eq(articles.groupId, articleGroups.id))
        .groupBy(articleGroups.id)
        .orderBy(desc(articleGroups.id))
        .limit(5);

      console.log('\n🆕 Recent Story Groups:');
      recentGroups.forEach(group => {
        const title = group.name.length > 60 ? group.name.substring(0, 60) + '...' : group.name;
        console.log(`   ${group.id}: ${title} (${group.articleCount} articles)`);
      });

      console.log('\n✅ Status check completed!');
    } catch (error) {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    }
  });

// Initialize full system
program
  .command('init')
  .description('Initialize the system: seed sources and run full pipeline')
  .action(async () => {
    try {
      console.log('🚀 Initializing enhanced ingestion system...');
      
      console.log('\n1️⃣ Seeding expanded sources...');
      await seedExpandedSources();
      
      console.log('\n2️⃣ Running initial ingestion...');
      await runEnhancedIngestion();
      
      console.log('\n3️⃣ Running enrichment (grouping & analysis)...');
      const enrichWorkerPath = path.join(process.cwd(), '..', 'enrich-worker', 'src', 'index.ts');
      
      await new Promise<void>((resolve, reject) => {
        const enrichProcess = spawn('bun', [enrichWorkerPath], {
          stdio: 'inherit',
          cwd: path.join(process.cwd(), '..', 'enrich-worker')
        });

        enrichProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Enrichment failed with code ${code}`));
          }
        });

        enrichProcess.on('error', (error) => {
          reject(error);
        });
      });
      
      console.log('\n✨ System initialization completed!');
      console.log('\n📋 Next steps:');
      console.log('   • Run "bun ingest-manager.ts status" to check system health');
      console.log('   • Run "bun ingest-manager.ts schedule" to start automated ingestion');
      console.log('   • Run "bun ingest-manager.ts full" for manual full pipeline runs');
      
    } catch (error) {
      console.error('❌ System initialization failed:', error);
      process.exit(1);
    }
  });

// Configuration display
program
  .command('config')
  .description('Display current configuration')
  .action(() => {
    console.log('⚙️  Enhanced Ingestion Configuration');
    console.log('=' .repeat(50));
    console.log(`TF-IDF Threshold: ${ENHANCED_CONFIG.TF_IDF_THRESHOLD}`);
    console.log(`Title Similarity Threshold: ${ENHANCED_CONFIG.TITLE_SIMILARITY_THRESHOLD}`);
    console.log(`Combined Threshold: ${ENHANCED_CONFIG.COMBINED_THRESHOLD}`);
    console.log(`Recent Hours Window: ${ENHANCED_CONFIG.RECENT_HOURS}`);
    console.log(`Batch Size: ${ENHANCED_CONFIG.BATCH_SIZE}`);
    console.log(`Max Group Size: ${ENHANCED_CONFIG.MAX_GROUP_SIZE}`);
    console.log(`Fetch Interval: ${ENHANCED_CONFIG.FETCH_INTERVAL} minutes`);
    console.log(`Cleanup Interval: ${ENHANCED_CONFIG.CLEANUP_INTERVAL} minutes`);
  });

// Parse command line arguments
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
