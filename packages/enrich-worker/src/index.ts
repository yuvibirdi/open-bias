import { Client, HttpConnection } from "@elastic/elasticsearch";
import { db, articles, sources } from "@open-bias/db";
import { eq, isNull, or, inArray } from "drizzle-orm";
import { groupArticles } from "./grouper";
import { analyzeArticleGroups } from "./analyzer-unified";
import { testAIConnectivity } from "./ai-analysis";

console.log("ELASTIC_URL:", process.env.ELASTIC_URL);
const esNode = process.env.ELASTIC_URL;
if (!esNode) {
  console.error("ELASTIC_URL environment variable is not set. Exiting.");
  process.exit(1);
}

// Explicitly use Node.js built-in http
const es = new Client({
  node: esNode,
  Connection: HttpConnection,
  headers: {
    'Accept': 'application/vnd.elasticsearch+json;compatible-with=8',
    'Content-Type': 'application/vnd.elasticsearch+json;compatible-with=8'
  }
});

async function main() {
  // Step 0: Test AI connectivity
  console.log("--- Testing AI Connectivity ---");
  const aiTest = await testAIConnectivity();
  if (aiTest.available) {
    console.log(`✅ AI Provider: ${aiTest.provider.toUpperCase()} - Available`);
  } else {
    console.error(`❌ AI Provider: ${aiTest.provider.toUpperCase()} - Not Available`);
    console.error(`Error: ${aiTest.error}`);
    console.log("⚠️ Proceeding without AI analysis...");
  }

  // Step 1: Group similar articles
  console.log("--- Starting Article Grouping ---");
  await groupArticles();
  console.log("--- Finished Article Grouping ---");

  // Step 2: Analyze grouped articles for bias
  console.log("--- Starting Bias Analysis ---");
  if (aiTest.available) {
    await analyzeArticleGroups();
  } else {
    console.log("⚠️ Skipping bias analysis - AI not available");
  }
  console.log("--- Finished Bias Analysis ---");

  // Step 3: Index enriched articles into Elasticsearch
  console.log("--- Starting Elasticsearch Indexing ---");
  const indexName = process.env.ELASTIC_INDEX ?? "articles";
  console.log("Checking if index exists:", indexName);

  try {
    const indexExists = await es.indices.exists({ index: indexName });
    console.log("Index exists:", indexExists);

    if (!indexExists) {
      console.log("Creating index with new mapping...");
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
            // New mappings for analysis fields
            politicalLeaning: { type: "float" },
            sensationalism: { type: "float" },
            framingSummary: { type: "text", index: false },
          }
        }
      });
      console.log("Index created with new mapping.");
    }
  } catch (err: unknown) {
    console.error("Error checking or creating Elasticsearch index:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Select articles that haven't been indexed yet
  const batch = await db
    .select({
      id: articles.id,
      title: articles.title,
      link: articles.link,
      summary: articles.summary,
      imageUrl: articles.imageUrl,
      bias: articles.bias, // Original simple bias
      published: articles.published,
      sourceId: articles.sourceId,
      sourceName: sources.name,
      sourceBias: sources.bias,
      groupId: articles.groupId,
      // New fields from analysis
      politicalLeaning: articles.politicalLeaning,
      sensationalism: articles.sensationalism,
      framingSummary: articles.framingSummary,
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(or(eq(articles.indexed, 0), isNull(articles.indexed)))
    .limit(100);

  if (batch.length === 0) {
    console.log("No new articles to index.");
    return;
  }
  console.log("Batch size for indexing:", batch.length);

  const operations = batch.flatMap((art) => {
    if (!art.id) {
        console.warn(`Article data is missing an ID (title: ${art.title || 'N/A'}). Skipping.`);
        return [];
    }
    return [
      { index: { _index: indexName, _id: art.id.toString() } },
      {
        title: art.title,
        link: art.link,
        summary: art.summary,
        imageUrl: art.imageUrl,
        bias: art.bias,
        published: art.published ? new Date(art.published).toISOString() : new Date().toISOString(),
        sourceId: art.sourceId,
        sourceName: art.sourceName,
        sourceBias: art.sourceBias,
        groupId: art.groupId,
        politicalLeaning: art.politicalLeaning ? parseFloat(art.politicalLeaning) : null,
        sensationalism: art.sensationalism ? parseFloat(art.sensationalism) : null,
        framingSummary: art.framingSummary
      }
    ];
  });

  try {
    if (operations.length > 0) {
      const bulkResponse = await es.bulk<{ index: { error?: unknown, status?: number, _id: string } }>({ refresh: true, operations });

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

      if (erroredDocuments.length > 0) {
        console.error("Errors during Elasticsearch bulk indexing:", JSON.stringify(erroredDocuments, null, 2));
      }

      if (successfulIds.length > 0) {
        await db.update(articles)
          .set({ indexed: 1 })
          .where(inArray(articles.id, successfulIds));
        console.log(`Successfully updated 'indexed' status for ${successfulIds.length} articles in the database.`);
      }
      
      if (erroredDocuments.length === 0) {
        console.log(`Successfully indexed all ${operations.length / 2} articles.`);
      }
    }
  } catch (err: unknown) {
    console.error("Fatal error during Elasticsearch bulk indexing or DB update:", err instanceof Error ? err.message : String(err));
  }

  console.log("Enrichment process completed.");
}

main().catch((err) => {
  console.error("Fatal error in main execution:", err.message || err);
  process.exit(1);
});