#!/usr/bin/env bun
/**
 * End-to-End Test Script
 * Tests the optimized pipeline with reduced LLM connection calls
 */

console.log("🧪 Starting End-to-End Pipeline Test...\n");

import { testAIConnectivity } from "./src/ai-analysis";
import { groupArticles } from "./src/grouper-optimized";
import { analyzeArticleGroups } from "./src/analyzer-unified";

// Test configuration - small numbers for quick testing
const TEST_CONFIG = {
  DEV_ARTICLE_LIMIT: 10,      // Very small for testing
  DEV_GROUP_ANALYSIS_LIMIT: 3  // Very small for testing
};

async function runEndToEndTest() {
  console.log("📋 Test Configuration:");
  console.log(`   Article Limit: ${TEST_CONFIG.DEV_ARTICLE_LIMIT}`);
  console.log(`   Group Analysis Limit: ${TEST_CONFIG.DEV_GROUP_ANALYSIS_LIMIT}\n`);

  try {
    // Step 1: Test AI connectivity (should happen only once)
    console.log("🔍 Step 1: Testing AI Connectivity");
    const startTime = Date.now();
    const aiTest = await testAIConnectivity();
    const connectTime = Date.now() - startTime;
    
    if (aiTest.available) {
      console.log(`✅ AI Provider: ${aiTest.provider.toUpperCase()} - Available (${connectTime}ms)\n`);
    } else {
      console.error(`❌ AI Provider: ${aiTest.provider.toUpperCase()} - Not Available`);
      console.error(`Error: ${aiTest.error}`);
      console.log("⚠️ Proceeding without AI analysis...\n");
    }

    // Step 2: Group articles with integrated bias analysis
    console.log("🔗 Step 2: Article Grouping + Immediate Bias Analysis");
    const groupStartTime = Date.now();
    
    await groupArticles({
      maxTotalArticles: TEST_CONFIG.DEV_ARTICLE_LIMIT,
      maxArticlesPerSource: 5,  // Small for testing
      semanticThreshold: 0.3,
      embeddingThreshold: 0.55,
      llmThreshold: 0.75,
      testMode: true,  // Enable test mode
      verbose: true,   // Enable verbose logging
      aiAvailable: aiTest.available
    });
    
    const groupTime = Date.now() - groupStartTime;
    console.log(`✅ Article grouping completed in ${groupTime}ms\n`);

    // Step 3: Fallback analysis
    console.log("🧠 Step 3: Fallback Bias Analysis");
    const fallbackStartTime = Date.now();
    
    if (aiTest.available) {
      await analyzeArticleGroups(TEST_CONFIG.DEV_GROUP_ANALYSIS_LIMIT);
      const fallbackTime = Date.now() - fallbackStartTime;
      console.log(`✅ Fallback analysis completed in ${fallbackTime}ms\n`);
    } else {
      console.log("⚠️ Skipping fallback analysis - AI not available\n");
    }

    const totalTime = Date.now() - startTime;
    console.log("✅ End-to-End Test Completed Successfully!");
    console.log(`📊 Performance Summary:`);
    console.log(`   AI Connection Test: ${connectTime}ms`);
    console.log(`   Article Grouping: ${groupTime}ms`);
    console.log(`   Total Time: ${totalTime}ms`);

  } catch (error) {
    console.error("💥 End-to-End Test Failed:", error);
    process.exit(1);
  }
}

// Run the test
runEndToEndTest();
