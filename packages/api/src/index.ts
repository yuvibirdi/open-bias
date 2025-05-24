import { Hono } from "hono";
import { cors } from "hono/cors";
import { Client, HttpConnection } from "@elastic/elasticsearch";
// import { db, articles as dbArticlesTable } from "@open-bias/db"; // Assuming you might use db later for sources or other metadata
// import { eq } from "drizzle-orm";

const app = new Hono();

// More explicit CORS configuration
app.use("*", cors());

const esNode = process.env.ELASTIC_URL;
if (!esNode) {
  console.error("ELASTIC_URL environment variable is not set.");
  // Potentially throw an error or provide a default, depending on desired behavior
}

const es = new Client({
  node: esNode,
  Connection: HttpConnection,
  headers: {
    'Accept': 'application/vnd.elasticsearch+json;compatible-with=8',
    'Content-Type': 'application/vnd.elasticsearch+json;compatible-with=8'
  }
});

interface ArticleSourceData {
  // Define based on your Elasticsearch document structure
  // These are examples, adjust them to match your actual ES data
  title: string;
  url?: string; // Assuming 'link' comes from 'url' in ES
  link?: string; // Allow both if data is inconsistent
  summary?: string;
  body?: string; // If summary is not available, maybe use body and truncate
  image_url?: string;
  imageUrl?: string; // Allow both
  bias_label?: number; // Assuming 'bias' comes from 'bias_label' in DB
  bias?: number; // Article's original bias at ingestion
  published_date?: string;
  published?: string; // Allow both
  sourceBias?: number; // Current bias of the source, from ES
  // Add any other fields you have in Elasticsearch
  [key: string]: any; // To allow other fields
}

interface Article {
  id: string; // Elasticsearch ID
  title: string;
  summary: string;
  imageUrl: string;
  bias: number;
  link: string;
  published: string; // Ensure this is always a string, even if defaulting
}

app.get("/articles", async (c) => {
  const biasQuery = c.req.query("bias");
  const limit = Number(c.req.query("limit") || 10);
  // const page = Number(c.req.query("page") || 1); // Add pagination if needed
  // const offset = (page - 1) * limit;

  const esQueryBody: any = {
    match_all: {}
  };

  if (biasQuery) {
    const biasValue = Number(biasQuery);
    if (!isNaN(biasValue) && [1, 2, 3].includes(biasValue)) {
      esQueryBody.bool = {
        filter: [
          { term: { bias: biasValue } } // Assuming 'bias' field in ES stores 1, 2, or 3
        ]
      };
      delete esQueryBody.match_all; // Remove match_all if filtering by bias
    } else {
      return c.json({ error: "Invalid bias value. Must be 1, 2, or 3." }, 400);
    }
  }

  try {
    const results = await es.search<ArticleSourceData>({
      index: process.env.ELASTIC_INDEX ?? "articles",
      size: limit,
      // from: offset, // Add for pagination
      query: esQueryBody,
      sort: [
        { "published_date": { "order": "desc", "unmapped_type": "date" } } // Sort by published_date if available
      ]
    });

    const hits = results.hits.hits.map((hit): Article | null => {
      const source = hit._source as ArticleSourceData;
      const id = hit._id; // _id is guaranteed by ES for hits in hits.hits

      if (!id) {
        // This case should ideally not happen with valid ES responses
        console.warn("Elasticsearch hit missing _id", hit);
        return null; // Skip this record
      }

      // Basic transformation and providing defaults
      return {
        id: id, // Now id is confirmed to be a string
        title: source.title || "No Title Available",
        summary: source.summary || (source.body ? source.body.substring(0, 150) + "..." : "No Summary Available"),
        // Use a placeholder if no image is found
        imageUrl: source.imageUrl || source.image_url || `https://via.placeholder.com/400x200?text=Article+${id.substring(0,5)}`,
        // Prioritize sourceBias if valid (1, 2, or 3), otherwise use article's original bias, then fallback to 0.
        bias: (source.sourceBias !== undefined && [1, 2, 3].includes(source.sourceBias)) ? source.sourceBias :
              (typeof source.bias === 'number' && [1, 2, 3].includes(source.bias)) ? source.bias :
              (typeof source.bias_label === 'number' && [1, 2, 3].includes(source.bias_label)) ? source.bias_label :
              0, // Default to 0 (Unknown)
        link: source.link || source.url || '#',
        // Ensure published is a valid date string or a default
        published: source.published || source.published_date || new Date().toISOString(),
      };
    }).filter(Boolean) as Article[]; // Filter out any nulls and assert type

    return c.json({ articles: hits });
  } catch (error: any) {
    console.error("Elasticsearch search error:", error.meta?.body || error.message || error);
    return c.json({ error: "Failed to fetch articles from Elasticsearch.", details: error.message }, 500);
  }
});

// Placeholder for a /sources endpoint if you need to manage news sources
// app.get("/sources", async (c) => {
//   // Example: Fetch sources from a database table
//   // const allSources = await db.select().from(dbSourcesTable);
//   // return c.json({ sources: allSources });
//   return c.json({ message: "Sources endpoint not yet implemented." });
// });

export default app;