#!/usr/bin/env bun
/**
 * Simple Integration Test
 * -----------------------
 * Tests key components without interfering with database connections
 */

import { testAIConnectivity } from "./src/ai-analysis";
import { testLLMConnection, validateModels } from "./src/llm-similarity";

async function main() {
  console.log("🚀 Running Simple Integration Test...\n");

  // Test 1: AI Connectivity
  console.log("1️⃣ Testing AI Connectivity...");
  try {
    const aiTest = await testAIConnectivity();
    if (aiTest.available) {
      console.log(`✅ AI Provider: ${aiTest.provider.toUpperCase()} - Available`);
    } else {
      console.log(`❌ AI Provider: ${aiTest.provider.toUpperCase()} - Not Available`);
      console.log(`   Error: ${aiTest.error}`);
    }
  } catch (error) {
    console.log(`❌ AI test failed: ${error}`);
  }

  // Test 2: Ollama Connectivity
  console.log("\n2️⃣ Testing Ollama Connectivity...");
  try {
    const ollamaTest = await testLLMConnection();
    if (ollamaTest) {
      console.log("✅ Ollama Connection - Available");
      
      const modelsValid = await validateModels();
      if (modelsValid) {
        console.log("✅ Ollama Models - Available");
      } else {
        console.log("❌ Ollama Models - Missing required models");
      }
    } else {
      console.log("❌ Ollama Connection - Not Available");
    }
  } catch (error) {
    console.log(`❌ Ollama test failed: ${error}`);
  }

  // Test 3: API Endpoints
  console.log("\n3️⃣ Testing API Endpoints...");
  try {
    const baseUrl = 'http://localhost:3000';
    
    const sourcesResponse = await fetch(`${baseUrl}/sources`);
    const sourcesData = await sourcesResponse.json();
    
    if (sourcesResponse.ok && Array.isArray(sourcesData.sources)) {
      console.log(`✅ Sources API - Available (${sourcesData.sources.length} sources)`);
    } else {
      console.log(`❌ Sources API - Error: ${sourcesData.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`❌ API test failed: ${error}`);
  }

  console.log("\n✅ Integration test completed!");
  console.log("\n💡 To run the full system:");
  console.log("   cd packages/enrich-worker && bun run src/index.ts");
}

main().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
