import { Client, HttpConnection } from "@elastic/elasticsearch";
import { db, articles } from "@open-bias/db";
import { eq } from "drizzle-orm";

console.log("ELASTIC_URL:", process.env.ELASTIC_URL);

// Explicitly use Node.js built-in http
const es = new Client({ 
  node: process.env.ELASTIC_URL,
  Connection: HttpConnection,
  headers: {
    'Accept': 'application/vnd.elasticsearch+json;compatible-with=8',
    'Content-Type': 'application/vnd.elasticsearch+json;compatible-with=8'
  }
});

async function main() {
  const indexName = process.env.ELASTIC_INDEX ?? "articles";
  console.log("Checking if index exists:", indexName);

  const indexExists = await es.indices.exists({ index: indexName });
  console.log("Index exists:", indexExists);

  if (!indexExists) {
    console.log("Creating index...");
    await es.indices.create({ index: indexName });
    console.log("Index created.");
  }

  const batch = await db
    .select()
    .from(articles)
    .where(eq(articles.indexed, 0))
    .limit(1);

  console.log("Batch size:", batch.length);

  for (const art of batch) {
    console.log("Indexing article:", art.title);
    await es.index({
      index: indexName,
      id: art.id.toString(),
      document: {
        title: art.title,
        link: art.link,
        published: art.published,
        bias: 2,
      },
    });
    await db.update(articles).set({ indexed: 1 }).where(eq(articles.id, art.id));
    console.log(`Indexed ${art.title}`);
  }

  await db.$client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
});