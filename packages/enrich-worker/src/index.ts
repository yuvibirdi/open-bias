import { Client, HttpConnection } from "@elastic/elasticsearch";
import { db, articles, type Article as DbArticle, sources } from "@open-bias/db";
import { eq, isNull, or, inArray } from "drizzle-orm";

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
  const indexName = process.env.ELASTIC_INDEX ?? "articles";
  console.log("Checking if index exists:", indexName);

  try {
    const indexExists = await es.indices.exists({ index: indexName });
    console.log("Index exists:", indexExists);

    if (!indexExists) {
      console.log("Creating index with mapping...");
      await es.indices.create({
        index: indexName,
        mappings: {
          properties: {
            title: { type: "text" },
            link: { type: "keyword" },
            summary: { type: "text" },
            imageUrl: { type: "keyword" },
            bias: { type: "integer" },
            published: { type: "date" },
            sourceId: { type: "integer" },
            sourceName: { type: "keyword" },
            sourceBias: { type: "integer" }
          }
        }
      });
      console.log("Index created with mapping.");
    }
  } catch (err: any) {
    console.error("Error checking or creating Elasticsearch index:", err.meta?.body || err.message || err);
    process.exit(1);
  }

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
      sourceBias: sources.bias
    })
    .from(articles)
    .leftJoin(sources, eq(articles.sourceId, sources.id))
    .where(or(eq(articles.indexed, 0), isNull(articles.indexed)))
    .limit(100);

  if (batch.length === 0) {
    console.log("No new articles to index.");
    process.exit(0);
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
        sourceBias: art.sourceBias
      }
    ];
  });

  try {
    if (operations.length > 0) {
      const bulkResponse = await es.bulk<{ index: { error?: any, status?: number } }>({ refresh: true, operations });

      if (bulkResponse.errors) {
        const erroredDocuments: any[] = [];
        bulkResponse.items.forEach((item, i) => {
          const actionType = Object.keys(item)[0] as 'index' | 'create' | 'update' | 'delete';
          const result = item[actionType];
          if (result && result.error) {
            erroredDocuments.push({
              status: result.status,
              error: result.error,
              document: operations[i * 2 + 1]
            });
          }
        });
        if (erroredDocuments.length > 0) {
            console.error("Errors during Elasticsearch bulk indexing:", JSON.stringify(erroredDocuments, null, 2));
        }
      }

      const articleIdsToUpdate = batch.map(art => art.id).filter(id => id !== null) as number[];
      if (articleIdsToUpdate.length > 0) {
        await db.update(articles)
          .set({ indexed: 1 })
          .where(inArray(articles.id, articleIdsToUpdate));
        console.log(`Attempted to update 'indexed' status for ${articleIdsToUpdate.length} articles in the database.`);
      }
      
      if (!bulkResponse.errors) {
        console.log(`Successfully indexed or attempted to index ${operations.length / 2} articles.`);
      }
    }
  } catch (err: any) {
    console.error("Fatal error during Elasticsearch bulk indexing or DB update:", err.meta?.body || err.message || err);
  }

  console.log("Enrichment process completed.");
}

main().catch((err) => {
  console.error("Fatal error in main execution:", err.message || err);
  process.exit(1);
});