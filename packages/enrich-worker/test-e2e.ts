#!/usr/bin/env bun
/**
 * End-to-End Testing Script for Open Bias System
 * -----------------------------------------------
 * Tests the complete pipeline from data seeding to AI analysis
 */

import { db, sources, articles, articleGroups } from "@open-bias/db";
import { seedSources } from "@open-bias/db/src/seedSources";
import { testAIConnectivity } from "./src/ai-analysis";
import { testLLMConnection, validateModels } from "./src/llm-similarity";
import { groupArticles } from "./src/grouper";
import { analyzeArticleGroups } from "./src/analyzer-unified";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (details) console.log(`   Details:`, details);
}

async function testDatabaseConnection() {
  try {
    const sourcesCount = await db.select().from(sources);
    addResult("Database Connection", true, undefined, { sourcesFound: sourcesCount.length });
    return true;
  } catch (error) {
    addResult("Database Connection", false, String(error));
    return false;
  }
}

async function testSourcesSeeding() {
  try {
    // Check if sources exist
    let sourcesCount = await db.select().from(sources);
    
    if (sourcesCount.length === 0) {
      console.log("📊 No sources found, sources are already seeded...");
      // Don't call seedSources here as it closes the pool
      sourcesCount = await db.select().from(sources);
    }
    
    addResult("Sources Seeding", sourcesCount.length > 0, undefined, { 
      sourcesCount: sourcesCount.length,
      sources: sourcesCount.slice(0, 3).map(s => ({ name: s.name, bias: s.bias }))
    });
    return sourcesCount.length > 0;
  } catch (error) {
    addResult("Sources Seeding", false, String(error));
    return false;
  }
}

async function testAIProviders() {
  try {
    // Test unified AI system
    const aiTest = await testAIConnectivity();
    addResult("AI Provider Detection", aiTest.available, aiTest.error, { 
      provider: aiTest.provider 
    });

    // Test Ollama specifically if available
    const ollamaTest = await testLLMConnection();
    addResult("Ollama Connection", ollamaTest, undefined, { 
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    });

    if (ollamaTest) {
      const modelsValid = await validateModels();
      addResult("Ollama Models", modelsValid);
    }

    return aiTest.available;
  } catch (error) {
    addResult("AI Providers", false, String(error));
    return false;
  }
}

async function testArticleGrouping() {
  try {
    // Check if we have ungrouped articles
    const ungroupedArticles = await db.query.articles.findMany({
      where: (articles, { isNull }) => isNull(articles.groupId)
    });

    console.log(`📰 Found ${ungroupedArticles.length} ungrouped articles`);
    
    if (ungroupedArticles.length < 2) {
      addResult("Article Grouping", false, "Need at least 2 ungrouped articles for testing", {
        ungroupedCount: ungroupedArticles.length
      });
      return false;
    }

    // Run grouping
    await groupArticles();

    // Check if groups were created
    const groups = await db.select().from(articleGroups);
    addResult("Article Grouping", groups.length > 0, undefined, {
      groupsCreated: groups.length,
      totalArticles: ungroupedArticles.length
    });

    return groups.length > 0;
  } catch (error) {
    addResult("Article Grouping", false, String(error));
    return false;
  }
}

async function testBiasAnalysis() {
  try {
    // Check if we have unanalyzed groups
    const unanalyzedGroups = await db.query.articleGroups.findMany({
      where: (articleGroups, { eq }) => eq(articleGroups.analysisCompleted, 0)
    });

    console.log(`🧠 Found ${unanalyzedGroups.length} unanalyzed groups`);

    if (unanalyzedGroups.length === 0) {
      addResult("Bias Analysis", false, "No unanalyzed groups found for testing", {
        unanalyzedCount: 0
      });
      return false;
    }

    // Run bias analysis
    await analyzeArticleGroups();

    // Check if analysis was completed
    const stillUnanalyzed = await db.query.articleGroups.findMany({
      where: (articleGroups, { eq }) => eq(articleGroups.analysisCompleted, 0)
    });

    const analyzedCount = unanalyzedGroups.length - stillUnanalyzed.length;
    addResult("Bias Analysis", analyzedCount > 0, undefined, {
      groupsAnalyzed: analyzedCount,
      totalGroups: unanalyzedGroups.length
    });

    return analyzedCount > 0;
  } catch (error) {
    addResult("Bias Analysis", false, String(error));
    return false;
  }
}

async function testAPIEndpoints() {
  try {
    // Test sources endpoint
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    
    const sourcesResponse = await fetch(`${baseUrl}/sources`);
    const sourcesData = await sourcesResponse.json();
    
    const sourcesValid = sourcesResponse.ok && Array.isArray(sourcesData.sources);
    addResult("Sources API Endpoint", sourcesValid, undefined, {
      statusCode: sourcesResponse.status,
      sourcesCount: sourcesData.sources?.length || 0,
      hasError: !!sourcesData.error
    });

    return sourcesValid;
  } catch (error) {
    addResult("API Endpoints", false, String(error));
    return false;
  }
}

async function generateTestReport() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 END-TO-END TEST REPORT");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`\n📈 OVERALL RESULTS: ${passed}/${total} tests passed (${passRate}%)`);

  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED! The system is working correctly.");
  } else {
    console.log("⚠️ Some tests failed. Please check the errors above.");
  }

  // Group results by status
  const passedTests = results.filter(r => r.passed);
  const failedTests = results.filter(r => !r.passed);

  if (passedTests.length > 0) {
    console.log("\n✅ PASSED TESTS:");
    passedTests.forEach(test => {
      console.log(`   • ${test.name}`);
    });
  }

  if (failedTests.length > 0) {
    console.log("\n❌ FAILED TESTS:");
    failedTests.forEach(test => {
      console.log(`   • ${test.name}: ${test.error || 'Unknown error'}`);
    });
  }

  console.log("\n💡 NEXT STEPS:");
  if (failedTests.some(t => t.name.includes("Database"))) {
    console.log("   • Check database connection and configuration");
  }
  if (failedTests.some(t => t.name.includes("AI") || t.name.includes("Ollama"))) {
    console.log("   • Set up Ollama locally or provide OpenAI/Gemini API keys");
  }
  if (failedTests.some(t => t.name.includes("Sources"))) {
    console.log("   • Run database seeding: bun run seed");
  }
  if (failedTests.some(t => t.name.includes("API"))) {
    console.log("   • Ensure API server is running on correct port");
  }

  console.log("=".repeat(60));
}

async function main() {
  console.log("🚀 Starting Open Bias End-to-End Testing...\n");

  // Test 1: Database Connection
  console.log("1️⃣ Testing Database Connection...");
  const dbConnected = await testDatabaseConnection();

  if (!dbConnected) {
    console.log("❌ Database connection failed. Stopping tests.");
    await generateTestReport();
    process.exit(1);
  }

  // Test 2: Sources Seeding
  console.log("\n2️⃣ Testing Sources Seeding...");
  await testSourcesSeeding();

  // Test 3: AI Providers
  console.log("\n3️⃣ Testing AI Providers...");
  const aiAvailable = await testAIProviders();

  // Test 4: Article Grouping
  console.log("\n4️⃣ Testing Article Grouping...");
  await testArticleGrouping();

  // Test 5: Bias Analysis (only if AI is available)
  if (aiAvailable) {
    console.log("\n5️⃣ Testing Bias Analysis...");
    await testBiasAnalysis();
  } else {
    console.log("\n5️⃣ Skipping Bias Analysis (AI not available)");
  }

  // Test 6: API Endpoints
  console.log("\n6️⃣ Testing API Endpoints...");
  await testAPIEndpoints();

  // Generate final report
  await generateTestReport();

  // Exit with appropriate code
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
main().catch(error => {
  console.error("❌ Test runner failed:", error);
  process.exit(1);
});
