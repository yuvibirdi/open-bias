import { Hono } from "hono";
import { cors } from "hono/cors";
import { db, sources as dbSources } from "@open-bias/db";

const app = new Hono();

// Add CORS middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

const ELASTIC_URL = process.env.ELASTIC_URL || 'http://localhost:9200';
const ELASTIC_INDEX = process.env.ELASTIC_INDEX || 'articles';

async function searchElasticsearch(query: Record<string, unknown>, size: number = 10) {
  const searchBody = {
    query,
    size,
    sort: [{ "published": { "order": "desc" } }]
  };

  const response = await fetch(`${ELASTIC_URL}/${ELASTIC_INDEX}/_search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(searchBody)
  });

  if (!response.ok) {
    throw new Error(`Elasticsearch error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

app.get("/articles", async (c) => {
  try {
    const bias = c.req.query("bias");
    const limit = Number(c.req.query("limit") || 10);

    const esQuery = bias ? {
      match: { bias: Number(bias) }
    } : { match_all: {} };

    const results = await searchElasticsearch(esQuery, limit);

    const hits = results.hits.hits.map((hit: { _id: string; _source?: Record<string, unknown> }) => ({
      id: hit._id,
      title: hit._source?.title || "No title",
      link: hit._source?.link || "#",
      summary: hit._source?.summary || "",
      published: hit._source?.published || new Date().toISOString(),
      bias: hit._source?.bias || 0,
      sourceName: hit._source?.sourceName || "Unknown"
    }));

    return c.json({ articles: hits });
  } catch (error) {
    console.error("Elasticsearch error:", error);
    return c.json({ articles: [] });
  }
});

app.get("/sources", async (c) => {
  try {
    console.log("Fetching sources from MySQL database...");
    
    // Get sources directly from MySQL database
    const sources = await db.select({
      id: dbSources.id,
      name: dbSources.name,
      rss: dbSources.rss,
      bias: dbSources.bias,
      url: dbSources.url,
      fetchedAt: dbSources.fetchedAt
    }).from(dbSources);

    console.log(`Found ${sources.length} sources in database`);

    // If no sources found in database, return fallback
    if (sources.length === 0) {
      console.log("No sources found in database, returning fallback data");
      return c.json({ 
        sources: [
          { id: 1, name: "BBC News", rss: "http://feeds.bbci.co.uk/news/rss.xml", bias: 2 },
          { id: 2, name: "CNN", rss: "http://rss.cnn.com/rss/edition.rss", bias: 1 },
          { id: 3, name: "Fox News", rss: "http://feeds.foxnews.com/foxnews/latest", bias: 3 }
        ]
      });
    }

    return c.json({ sources });
  } catch (error) {
    console.error("Sources endpoint error:", error);
    // Fallback to hardcoded sources on error
    return c.json({ 
      sources: [
        { id: 1, name: "BBC News", rss: "http://feeds.bbci.co.uk/news/rss.xml", bias: 2 },
        { id: 2, name: "CNN", rss: "http://rss.cnn.com/rss/edition.rss", bias: 1 },
        { id: 3, name: "Fox News", rss: "http://feeds.foxnews.com/foxnews/latest", bias: 3 }
      ]
    });
  }
});

export default app;