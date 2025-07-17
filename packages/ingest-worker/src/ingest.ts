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
  runSimpleIngestion, 
  SimpleIngestScheduler, 
  INGEST_CONFIG 
} from './simple-ingest';
import { db, sources, articles, articleGroups, storyCoverage } from '@open-bias/db';
import { count, sql, desc, eq } from 'drizzle-orm';
import { spawn } from 'child_process';
import path from 'path';

const program = new Command();

program
  .name('ingest')
  .description('Streamlined story ingestion management CLI')
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
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to seed sources:', error);
      process.exit(1);
    }
  });

// Run single ingestion
program
  .command('ingest')
  .description('Run a single simple ingestion cycle (fetch articles only)')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log('🚀 Starting simple ingestion with verbose logging...');
      }
      await runSimpleIngestion();
      console.log('✅ Simple ingestion completed successfully!');
      console.log('💡 Run "bun ingest.ts enrich" to group articles and perform analysis');
      process.exit(0);
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
      
      const enrichWorkerPath = path.join(process.cwd(), 'packages', 'enrich-worker', 'src', 'index.ts');
      
      const enrichProcess = spawn('bun', [enrichWorkerPath], {
        stdio: 'inherit',
        cwd: path.join(process.cwd(), 'packages', 'enrich-worker')
      });

      enrichProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Enrichment completed successfully!');
          process.exit(0);
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
      
      // Step 1: Simple Ingestion
      console.log('\n📥 Step 1: Simple Ingestion (fetch articles)');
      await runSimpleIngestion();
      console.log('✅ Ingestion completed');
      
      // Step 2: Enrichment
      console.log('\n🧠 Step 2: Enrichment (Grouping & Analysis)');
      const enrichWorkerPath = path.join(process.cwd(), 'packages', 'enrich-worker', 'src', 'index.ts');
      await new Promise<void>((resolve, reject) => {
        const enrichProcess = spawn('bun', [enrichWorkerPath], {
          stdio: 'inherit',
          cwd: path.join(process.cwd(), 'packages', 'enrich-worker')
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
      process.exit(0);
      
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
    
    const scheduler = new SimpleIngestScheduler();
    scheduler.start(interval);

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

// Cleanup command - now handled by enrich-worker
program
  .command('cleanup')
  .description('Run cleanup via enrich-worker (grouping, analysis, and cleanup)')
  .action(async () => {
    try {
      console.log('🧹 Running cleanup via enrich-worker...');
      const enrichWorkerPath = path.join(process.cwd(), 'packages', 'enrich-worker', 'src', 'index.ts');
      
      await new Promise<void>((resolve, reject) => {
        const enrichProcess = spawn('bun', [enrichWorkerPath], {
          stdio: 'inherit',
          cwd: path.join(process.cwd(), 'packages', 'enrich-worker')
        });

        enrichProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Cleanup completed successfully!');
            resolve();
          } else {
            reject(new Error(`Cleanup failed with code ${code}`));
          }
        });

        enrichProcess.on('error', (error) => {
          reject(error);
        });
      });
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
      console.log('🚀 Initializing streamlined ingestion system...');
      
      console.log('\n1️⃣ Seeding expanded sources...');
      await seedExpandedSources();
      
      console.log('\n2️⃣ Running initial ingestion...');
      await runSimpleIngestion();
      
      console.log('\n3️⃣ Running enrichment (grouping & analysis)...');
      const enrichWorkerPath = path.join(process.cwd(), 'packages', 'enrich-worker', 'src', 'index.ts');
      
      await new Promise<void>((resolve, reject) => {
        const enrichProcess = spawn('bun', [enrichWorkerPath], {
          stdio: 'inherit',
          cwd: path.join(process.cwd(), 'packages', 'enrich-worker')
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
      console.log('   • Run "bun ingest.ts status" to check system health');
      console.log('   • Run "bun ingest.ts schedule" to start automated ingestion');
      console.log('   • Run "bun ingest.ts full" for manual full pipeline runs');
      process.exit(0);
      
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
    console.log('⚙️  Streamlined Ingestion Configuration');
    console.log('=' .repeat(50));
    console.log(`Minimum Title Length: ${INGEST_CONFIG.MIN_TITLE_LENGTH}`);
    console.log(`Default Fetch Interval: ${INGEST_CONFIG.FETCH_INTERVAL} minutes`);
    console.log(`Request Timeout: ${INGEST_CONFIG.REQUEST_TIMEOUT}ms`);
    console.log('\n💡 Note: Advanced configuration (thresholds, grouping, etc.) is handled by enrich-worker');
  });

// Parse command line arguments
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
