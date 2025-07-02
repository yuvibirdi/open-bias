#!/usr/bin/env bun
/**
 * Configurable Grouper Runner
 * ---------------------------
 * Run the optimized grouper with configurable parameters
 * 
 * Usage:
 *   bun run run-grouper.ts [maxArticles] [maxPerSource] [embeddingThreshold] [llmThreshold]
 * 
 * Examples:
 *   bun run run-grouper.ts 50 5 0.7 0.8    # Process 50 articles, max 5 per source
 *   bun run run-grouper.ts -1 50 0.6 0.75   # Process ALL articles, max 50 per source
 *   bun run run-grouper.ts                  # Use defaults
 */

import { groupArticles } from "./src/grouper-optimized";

function parseArgs(): {
  maxTotalArticles: number;
  maxArticlesPerSource: number;
  semanticThreshold: number;
  embeddingThreshold: number;
  llmThreshold: number;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  
  return {
    maxTotalArticles: args[0] ? parseInt(args[0]) : 100,
    maxArticlesPerSource: args[1] ? parseInt(args[1]) : 20,
    semanticThreshold: args[2] ? parseFloat(args[2]) : 0.3,
    embeddingThreshold: args[3] ? parseFloat(args[3]) : 0.7,
    llmThreshold: args[4] ? parseFloat(args[4]) : 0.8,
    verbose: args.includes('--verbose') || args.includes('-v')
  };
}

async function main() {
  const config = parseArgs();
  
  console.log("🎯 Configurable Grouper Runner");
  console.log("==============================\n");
  
  console.log("📋 Configuration:");
  console.log(`   Max total articles: ${config.maxTotalArticles === -1 ? 'ALL' : config.maxTotalArticles}`);
  console.log(`   Max per source: ${config.maxArticlesPerSource}`);
  console.log(`   Semantic threshold: ${config.semanticThreshold}`);
  console.log(`   Embedding threshold: ${config.embeddingThreshold}`);
  console.log(`   LLM threshold: ${config.llmThreshold}`);
  console.log(`   Verbose mode: ${config.verbose}\n`);
  
  const startTime = Date.now();
  
  try {
    await groupArticles({
      maxTotalArticles: config.maxTotalArticles,
      maxArticlesPerSource: config.maxArticlesPerSource,
      semanticThreshold: config.semanticThreshold,
      embeddingThreshold: config.embeddingThreshold,
      llmThreshold: config.llmThreshold,
      testMode: false,
      verbose: config.verbose
    });
    
    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n🎉 Grouping completed in ${totalTime}s`);
    
  } catch (error) {
    console.error("❌ Grouping failed:", error);
    process.exit(1);
  }
}

// Handle CLI help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Configurable Grouper Runner

Usage:
  bun run run-grouper.ts [maxArticles] [maxPerSource] [semanticThreshold] [embeddingThreshold] [llmThreshold]

Parameters:
  maxArticles        - Total articles to process (-1 for all, default: 100)
  maxPerSource       - Max articles per source (default: 20)
  semanticThreshold  - Semantic keyword similarity threshold (default: 0.3)
  embeddingThreshold - Embedding similarity threshold (default: 0.7)
  llmThreshold       - LLM similarity threshold (default: 0.8)

Flags:
  --verbose, -v      - Enable verbose logging
  --help, -h         - Show this help

Examples:
  bun run run-grouper.ts 50 5 0.3 0.7 0.8      # Process 50 articles with custom thresholds
  bun run run-grouper.ts -1 50 0.2 0.6 0.75     # Process ALL articles with looser matching
  bun run run-grouper.ts --verbose              # Use defaults with verbose logging
  `);
  process.exit(0);
}

main().catch(error => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
