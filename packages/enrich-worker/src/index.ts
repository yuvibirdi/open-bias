/**
 * Enrich-Worker Main Entry Point
 * ------------------------------
 * Core functions:
 * 1. Article grouping using optimized multi-stage algorithm
 * 2. AI-powered bias analysis of grouped articles
 * 3. Elasticsearch indexing of enriched articles
 */

import { Client, HttpConnection } from "@elastic/elasticsearch";
import { db, articles, sources } from "@open-bias/db";
import { eq, isNull, or, inArray } from "drizzle-orm";
import { groupArticles } from "./grouper-optimized";
import { analyzeArticleGroups } from "./analyzer-unified";
import { testAIConnectivity } from "./ai-analysis";

console.log("ELASTIC_URL:", process.env.ELASTIC_URL);
const esNode = process.env.ELASTIC_URL;
if (!esNode) {
  console.error("ELASTIC_URL environment variable is not set. Exiting.");
  process.exit(1);
}

// Elasticsearch client setup
const es = new Client({
  node: esNode,
  Connection: HttpConnection,
  headers: {
    'Accept': 'application/vnd.elasticsearch+json;compatible-with=8',
    'Content-Type': 'application/vnd.elasticsearch+json;compatible-with=8'
  }
});

/**
 * Main enrichment pipeline
 */
async function main() {
  console.log("🚀 Starting Enrich-Worker Pipeline...\n");

  // Step 1: Test AI connectivity
  console.log("🔍 Step 1: Testing AI Connectivity");
  const aiTest = await testAIConnectivity();
  if (aiTest.available) {
    console.log(`✅ AI Provider: ${aiTest.provider.toUpperCase()} - Available\n`);
  } else {
    console.error(`❌ AI Provider: ${aiTest.provider.toUpperCase()} - Not Available`);
    console.error(`Error: ${aiTest.error}`);
    console.log("⚠️ Proceeding without AI analysis...\n");
  }

  // Step 2: Group similar articles using optimized multi-stage algorithm
  console.log("🔗 Step 2: Article Grouping (Multi-Stage Algorithm)");
  try {
    await groupArticles({
      maxTotalArticles: 0, // Process all available articles
      maxArticlesPerSource: 50,
      semanticThreshold: 0.3,
      embeddingThreshold: 0.55,
      llmThreshold: 0.75,
      testMode: false,
      verbose: false
    });
    console.log("✅ Article grouping completed\n");
  } catch (error) {
    console.error("❌ Article grouping failed:", error);
    console.log("⚠️ Continuing with bias analysis and indexing...\n");
  }

  // Step 3: Analyze grouped articles for bias
  console.log("🧠 Step 3: AI Bias Analysis");
  if (aiTest.available) {
    try {
      await analyzeArticleGroups();
      console.log("✅ Bias analysis completed\n");
    } catch (error) {
      console.error("❌ Bias analysis failed:", error);
      console.log("⚠️ Continuing with indexing...\n");
    }
  } else {
    console.log("⚠️ Skipping bias analysis - AI not available\n");
  }

  // Step 4: Index enriched articles into Elasticsearch
  console.log("📊 Step 4: Elasticsearch Indexing");
  await indexArticlesToElasticsearch();
  
  console.log("✅ Enrich-Worker pipeline completed successfully!");
}

/**
 * Index enriched articles to Elasticsearch
 */
async function indexArticlesToElasticsearch() {
  const indexName = process.env.ELASTIC_INDEX ?? "articles";
  console.log(`   Checking index: ${indexName}`);

  try {
    // Ensure index exists with proper mapping
    const indexExists = await es.indices.exists({ index: indexName });
    
    if (!indexExists) {
      console.log("   Creating index with mapping...");
      await es.indices.create({
        index: indexName,
        mappings: {
          properties: {
            title: { type: "text" },
            link: { type: "keyword" },
            summary: { type: "text" },
            imageUrl: { type: "keyword", index: false },
            bias: { type: "integer" },
            published: { type: "date" },
            sourceId: { type: "integer" },
            sourceName: { type: "keyword" },
            sourceBias: { type: "integer" },
            groupId: { type: "integer" },
            // Analysis fields
            politicalLeaning: { type: "float" },
            sensationalism: { type: "float" },
            framingSummary: { type: "text", index: false },
          }
        }
      });
      console.log("   ✅ Index created");
    }

    // Get unindexed articles
    const batch = await db
      .select({
        id: articles.id,
        title: articles.title,
        link: articles.link,
        summary: articles.summary,
        imageUrl: articles.imageUrl,
        bias: articles.bias,
        published: articles.published,
        sourceId: articles.sourceId,
        sourceName: sources.name,
        sourceBias: sources.bias,
        groupId: articles.groupId,
        politicalLeaning: articles.politicalLeaning,
        sensationalism: articles.sensationalism,
        framingSummary: articles.framingSummary,
      })
      .from(articles)
      .leftJoin(sources, eq(articles.sourceId, sources.id))
      .where(or(eq(articles.indexed, 0), isNull(articles.indexed)))
      .limit(100);

    if (batch.length === 0) {
      console.log("   ✅ No new articles to index");
      return;
    }

    console.log(`   📥 Indexing ${batch.length} articles...`);

    // Prepare bulk operations
    const operations = batch.flatMap((article) => {
      if (!article.id) {
        console.warn(`   ⚠️ Article missing ID: ${article.title || 'N/A'}`);
        return [];
      }

      return [
        { index: { _index: indexName, _id: article.id.toString() } },
        {
          title: article.title,
          link: article.link,
          summary: article.summary,
          imageUrl: article.imageUrl,
          bias: article.bias,
          published: article.published ? new Date(article.published).toISOString() : new Date().toISOString(),
          sourceId: article.sourceId,
          sourceName: article.sourceName,
          sourceBias: article.sourceBias,
          groupId: article.groupId,
          politicalLeaning: article.politicalLeaning ? parseFloat(article.politicalLeaning) : null,
          sensationalism: article.sensationalism ? parseFloat(article.sensationalism) : null,
          framingSummary: article.framingSummary
        }
      ];
    });

    // Execute bulk indexing
    if (operations.length > 0) {
      const bulkResponse = await es.bulk<{ index: { error?: unknown, status?: number, _id: string } }>({ 
        refresh: true, 
        operations 
      });

      const successfulIds: number[] = [];
      const erroredDocuments: unknown[] = [];

      bulkResponse.items.forEach((action, i) => {
        const operation = Object.keys(action)[0] as 'index';
        const result = action[operation];

        if (result && result.error) {
          erroredDocuments.push({
            status: result.status,
            error: result.error,
            document: operations[i * 2 + 1],
          });
        } else if (result && result._id) {
          const articleId = parseInt(result._id, 10);
          if (!isNaN(articleId)) {
            successfulIds.push(articleId);
          }
        }
      });

      // Update database with successful indexing
      if (successfulIds.length > 0) {
        await db.update(articles)
          .set({ indexed: 1 })
          .where(inArray(articles.id, successfulIds));
        console.log(`   ✅ Successfully indexed ${successfulIds.length} articles`);
      }

      if (erroredDocuments.length > 0) {
        console.error(`   ❌ ${erroredDocuments.length} articles failed to index:`, 
          JSON.stringify(erroredDocuments.slice(0, 3), null, 2));
      }
    }

  } catch (error) {
    console.error("❌ Elasticsearch indexing failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
// Execute main pipeline
main().catch((error) => {
  console.error("💥 Enrich-Worker fatal error:", error.message || error);
  process.exit(1);
});