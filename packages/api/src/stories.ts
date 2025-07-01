import { Hono } from "hono";
import { db, articles, sources, articleGroups, blindspots } from "@open-bias/db";
import { eq, desc, and, sql, count, avg } from "drizzle-orm";

const app = new Hono();

// Elasticsearch configuration
const ELASTIC_URL = process.env.ELASTIC_URL || 'http://localhost:9200';
const ELASTIC_INDEX = process.env.ELASTIC_INDEX || 'articles';

// Get trending stories with coverage analysis
app.get("/api/stories/trending", async (c) => {
  try {
    const limit = Number(c.req.query("limit") || 20);
    const timeframe = c.req.query("timeframe") || "24h";
    
    // Calculate date threshold based on timeframe
    const hoursBack = timeframe === "1h" ? 1 : timeframe === "6h" ? 6 : timeframe === "24h" ? 24 : 168; // default to week
    const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const rawStories = await db
      .select({
        id: articleGroups.id,
        title: articleGroups.name,
        neutralSummary: articleGroups.neutralSummary,
        totalArticles: sql<number>`COUNT(${articles.id})`,
        leftCoverage: sql<number>`SUM(CASE WHEN ${sources.bias} = 'left' THEN 1 ELSE 0 END)`,
        centerCoverage: sql<number>`SUM(CASE WHEN ${sources.bias} = 'center' THEN 1 ELSE 0 END)`,
        rightCoverage: sql<number>`SUM(CASE WHEN ${sources.bias} = 'right' THEN 1 ELSE 0 END)`,
        coverageScore: sql<number>`(COUNT(DISTINCT ${sources.bias}) * 100.0 / 3.0)`,
        firstReported: sql<Date>`MIN(${articles.published})`,
        lastUpdated: sql<Date>`MAX(${articles.published})`,
        mostUnbiasedArticleId: articleGroups.mostUnbiasedArticleId,
      })
      .from(articleGroups)
      .innerJoin(articles, eq(articles.groupId, articleGroups.id))
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(sql`${articles.published} >= ${dateThreshold}`)
      .groupBy(articleGroups.id)
      .having(sql`COUNT(${articles.id}) >= 2`) // Only stories with multiple sources
      .orderBy(desc(sql`COUNT(${articles.id})`), desc(sql`MAX(${articles.published})`))
      .limit(limit);

    // Convert string numbers to actual numbers for frontend compatibility
    const stories = rawStories.map(story => ({
      ...story,
      totalArticles: Number(story.totalArticles),
      leftCoverage: Number(story.leftCoverage),
      centerCoverage: Number(story.centerCoverage),
      rightCoverage: Number(story.rightCoverage),
      coverageScore: Number(story.coverageScore),
    }));

    return c.json({ stories });
  } catch (error) {
    console.error("Error fetching trending stories:", error);
    return c.json({ error: "Failed to fetch trending stories" }, 500);
  }
});

// Get story details with all articles and bias analysis
app.get("/api/stories/:id", async (c) => {
  try {
    const storyId = Number(c.req.param('id'));
    
    let story: any = null;
    let storyArticles: any[] = [];
    
    try {
      // Get story details
      story = await db.query.articleGroups.findFirst({
        where: eq(articleGroups.id, storyId),
      });

      if (story) {
        // Get all articles in this story with source information
        storyArticles = await db
          .select({
            id: articles.id,
            title: articles.title,
            link: articles.link,
            summary: articles.summary,
            published: articles.published,
            sourceName: sources.name,
            sourceBias: sources.bias,
            sourceUrl: sources.url,
            politicalLeaning: articles.politicalLeaning,
            sensationalism: articles.sensationalism,
            framingSummary: articles.framingSummary,
            imageUrl: articles.imageUrl,
          })
          .from(articles)
          .innerJoin(sources, eq(articles.sourceId, sources.id))
          .where(eq(articles.groupId, storyId))
          .orderBy(desc(articles.published));
      }
    } catch (dbError) {
      console.warn("Database error fetching story:", dbError);
      return c.json({ error: "Failed to fetch story details" }, 500);
    }

    if (!story) {
      return c.json({ error: "Story not found" }, 404);
    }

    // Calculate bias distribution
    const biasDistribution = storyArticles.reduce((acc, article) => {
      const bias = article.sourceBias || 'unknown';
      acc[bias] = (acc[bias] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group articles by bias
    const articlesByBias = {
      left: storyArticles.filter(a => a.sourceBias === 'left'),
      center: storyArticles.filter(a => a.sourceBias === 'center'),
      right: storyArticles.filter(a => a.sourceBias === 'right'),
      unknown: storyArticles.filter(a => a.sourceBias === 'unknown'),
    };

    return c.json({
      story,
      articles: storyArticles,
      biasDistribution,
      articlesByBias,
      totalArticles: storyArticles.length,
      coverageScore: Math.round((Object.keys(biasDistribution).filter(k => k !== 'unknown').length / 3) * 100),
    });
  } catch (error) {
    console.error("Error fetching story details:", error);
    return c.json({ error: "Failed to fetch story details" }, 500);
  }
});

// Get user's personalized blindspots
app.get("/api/users/:userId/blindspots", async (c) => {
  try {
    const userId = Number(c.req.param('userId'));
    const limit = Number(c.req.query("limit") || 10);

    const userBlindspots = await db
      .select({
        id: blindspots.id,
        groupId: blindspots.groupId,
        storyTitle: articleGroups.name,
        blindspotType: blindspots.blindspotType,
        severity: blindspots.severity,
        description: blindspots.description,
        suggestedSources: blindspots.suggestedSources,
        createdAt: blindspots.createdAt,
      })
      .from(blindspots)
      .innerJoin(articleGroups, eq(blindspots.groupId, articleGroups.id))
      .where(and(eq(blindspots.userId, userId), eq(blindspots.dismissed, 0)))
      .orderBy(desc(blindspots.createdAt))
      .limit(limit);

    return c.json({ blindspots: userBlindspots });
  } catch (error) {
    console.error("Error fetching user blindspots:", error);
    return c.json({ error: "Failed to fetch blindspots" }, 500);
  }
});

// Analyze reading patterns and detect blindspots
app.post("/api/users/:userId/analyze-blindspots", async (c) => {
  try {
    const userId = Number(c.req.param('userId'));
    
    // This would typically involve complex analysis of user reading patterns
    // For now, we'll implement a simple version that detects underrepresented viewpoints
    
    // Get recent stories the user might have missed based on their reading pattern
    const recentStories = await db
      .select({
        id: articleGroups.id,
        name: articleGroups.name,
        leftCoverage: sql<number>`SUM(CASE WHEN ${sources.bias} = 'left' THEN 1 ELSE 0 END)`,
        centerCoverage: sql<number>`SUM(CASE WHEN ${sources.bias} = 'center' THEN 1 ELSE 0 END)`,
        rightCoverage: sql<number>`SUM(CASE WHEN ${sources.bias} = 'right' THEN 1 ELSE 0 END)`,
      })
      .from(articleGroups)
      .innerJoin(articles, eq(articles.groupId, articleGroups.id))
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(sql`${articles.published} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`)
      .groupBy(articleGroups.id)
      .having(sql`COUNT(${articles.id}) >= 2`);

    // Detect stories with missing perspectives
    const blindspotsToCreate = recentStories.filter(story => {
      const hasLeft = story.leftCoverage > 0;
      const hasCenter = story.centerCoverage > 0;
      const hasRight = story.rightCoverage > 0;
      
      return !(hasLeft && hasCenter && hasRight); // Missing at least one perspective
    });

    // Create blindspot records
    for (const story of blindspotsToCreate.slice(0, 5)) { // Limit to 5 per analysis
      const missingPerspectives = [];
      if (story.leftCoverage === 0) missingPerspectives.push('left');
      if (story.centerCoverage === 0) missingPerspectives.push('center');
      if (story.rightCoverage === 0) missingPerspectives.push('right');

      const blindspotType = missingPerspectives.length === 1 ? 
        `${missingPerspectives[0]}_missing` : 'underreported';

      // Check if blindspot already exists
      const existing = await db.query.blindspots.findFirst({
        where: and(
          eq(blindspots.userId, userId),
          eq(blindspots.groupId, story.id),
          eq(blindspots.dismissed, 0)
        ),
      });

      if (!existing) {
        await db.insert(blindspots).values({
          userId,
          groupId: story.id,
          blindspotType: blindspotType as "left_missing" | "right_missing" | "center_missing" | "underreported" | null,
          severity: missingPerspectives.length > 1 ? 'high' : 'medium',
          description: `This story lacks coverage from ${missingPerspectives.join(' and ')} sources.`,
          suggestedSources: JSON.stringify([]), // Would be populated with actual source suggestions
        });
      }
    }

    return c.json({ 
      message: "Blindspot analysis completed",
      newBlindspotsFound: blindspotsToCreate.length,
    });
  } catch (error) {
    console.error("Error analyzing blindspots:", error);
    return c.json({ error: "Failed to analyze blindspots" }, 500);
  }
});

// Get bias distribution across all stories
app.get("/api/analytics/bias-distribution", async (c) => {
  try {
    const timeframe = c.req.query("timeframe") || "7d";
    const hoursBack = timeframe === "24h" ? 24 : timeframe === "7d" ? 168 : 720; // 30d
    const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const distribution = await db
      .select({
        bias: sources.bias,
        articleCount: count(articles.id),
        avgPoliticalLeaning: avg(articles.politicalLeaning),
        avgSensationalism: avg(articles.sensationalism),
      })
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(sql`${articles.published} >= ${dateThreshold}`)
      .groupBy(sources.bias);

    return c.json({ distribution });
  } catch (error) {
    console.error("Error fetching bias distribution:", error);
    return c.json({ error: "Failed to fetch bias distribution" }, 500);
  }
});

// Search stories with advanced filters
app.get("/api/stories/search", async (c) => {
  try {
    const query = c.req.query("q") || "";
    const coverage = c.req.query("coverage"); // "full", "partial", "limited"
    const timeframe = c.req.query("timeframe") || "7d";
    const limit = Number(c.req.query("limit") || 20);

    let searchQuery = {
      bool: {
        must: [] as Record<string, unknown>[],
        filter: [] as Record<string, unknown>[],
      }
    };

    if (query) {
      searchQuery.bool.must.push({
        multi_match: {
          query,
          fields: ["title^2", "summary", "neutralSummary"],
        }
      });
    } else {
      searchQuery.bool.must.push({ match_all: {} });
    }

    // Add time filter
    const hoursBack = timeframe === "24h" ? 24 : timeframe === "7d" ? 168 : 720;
    const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    searchQuery.bool.filter.push({
      range: {
        published: {
          gte: dateThreshold.toISOString(),
        }
      }
    });

    // Search in Elasticsearch
    const response = await fetch(`${ELASTIC_URL}/${ELASTIC_INDEX}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        size: limit,
        sort: [{ published: { order: "desc" } }],
        aggs: {
          by_group: {
            terms: { field: "groupId" },
            aggs: {
              bias_distribution: {
                terms: { field: "sourceBias" }
              }
            }
          }
        }
      })
    });

    const results = await response.json();
    
    // Process results to group by story and calculate coverage
    const storiesMap = new Map();
    
    for (const hit of results.hits.hits) {
      const article = hit._source;
      const groupId = article.groupId;
      
      if (!storiesMap.has(groupId)) {
        storiesMap.set(groupId, {
          id: groupId,
          articles: [],
          biases: new Set(),
        });
      }
      
      const story = storiesMap.get(groupId);
      story.articles.push(article);
      story.biases.add(article.sourceBias);
    }

    // Convert to array and add coverage scores
    const stories = Array.from(storiesMap.values()).map(story => ({
      ...story,
      totalArticles: story.articles.length,
      coverageScore: Math.round((story.biases.size / 3) * 100),
      biases: Array.from(story.biases),
    }));

    // Apply coverage filter
    let filteredStories = stories;
    if (coverage === "full") {
      filteredStories = stories.filter(s => s.coverageScore >= 100);
    } else if (coverage === "partial") {
      filteredStories = stories.filter(s => s.coverageScore >= 50 && s.coverageScore < 100);
    } else if (coverage === "limited") {
      filteredStories = stories.filter(s => s.coverageScore < 50);
    }

    return c.json({
      stories: filteredStories.slice(0, limit),
      total: filteredStories.length,
      aggregations: results.aggregations,
    });
  } catch (error) {
    console.error("Error searching stories:", error);
    return c.json({ error: "Failed to search stories" }, 500);
  }
});

// Create or update story groups based on article similarity
app.post("/api/stories/group-articles", async (c) => {
  try {
    // This endpoint can be called periodically to group similar articles
    const hoursBack = 48; // Look at articles from last 48 hours
    const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Get recent articles that aren't grouped yet
    const ungroupedArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        sourceId: articles.sourceId,
        sourceBias: sources.bias,
        published: articles.published,
      })
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(and(
        sql`${articles.published} >= ${dateThreshold}`,
        sql`${articles.groupId} IS NULL`
      ))
      .orderBy(desc(articles.published));

    let groupsCreated = 0;
    const processedArticles = new Set<number>();

    // Simple grouping based on title similarity
    for (const article of ungroupedArticles) {
      if (processedArticles.has(article.id)) continue;

      // Find similar articles
      const similarArticles = ungroupedArticles.filter(other => 
        other.id !== article.id && 
        !processedArticles.has(other.id) &&
        calculateTextSimilarity(article.title, other.title) > 0.6
      );

      if (similarArticles.length > 0) {
        // Create a new group
        const groupResult = await db.insert(articleGroups).values({
          name: article.title.substring(0, 500),
          masterArticleId: article.id,
        });

        const groupId = Number(groupResult[0]?.insertId);

        // Add all similar articles to the group
        const articlesToGroup = [article, ...similarArticles];
        for (const articleToGroup of articlesToGroup) {
          await db.update(articles)
            .set({ groupId })
            .where(eq(articles.id, articleToGroup.id));
          
          processedArticles.add(articleToGroup.id);
        }

        // Update coverage tracking
        await updateCoverageTracking(groupId, articlesToGroup);
        groupsCreated++;
      }
    }

    return c.json({ 
      message: `Created ${groupsCreated} story groups`,
      groupsCreated,
      processedArticles: processedArticles.size 
    });
  } catch (error) {
    console.error("Error grouping articles:", error);
    return c.json({ error: "Failed to group articles" }, 500);
  }
});

// Helper function to calculate text similarity
function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const words1 = new Set(normalize(text1).split(/\s+/));
  const words2 = new Set(normalize(text2).split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

// Helper function to update coverage tracking for a story group
async function updateCoverageTracking(groupId: number, articlesInGroup: any[]) {
  const leftCount = articlesInGroup.filter(a => a.sourceBias === 'left').length;
  const centerCount = articlesInGroup.filter(a => a.sourceBias === 'center').length;
  const rightCount = articlesInGroup.filter(a => a.sourceBias === 'right').length;
  const totalCount = articlesInGroup.length;

  // Calculate coverage score (0-100) based on perspective representation
  const perspectives = [leftCount > 0, centerCount > 0, rightCount > 0].filter(Boolean).length;
  const coverageScore = Math.round((perspectives / 3) * 100);

  const firstReported = articlesInGroup.reduce((earliest, article) => 
    !earliest || new Date(article.published) < new Date(earliest) ? article.published : earliest, 
    null
  );

  // Insert or update coverage tracking - for now just log it since we have schema issues
  console.log(`Coverage for group ${groupId}: L:${leftCount} C:${centerCount} R:${rightCount} Score:${coverageScore}%`);
}

export default app;
