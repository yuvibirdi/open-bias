import { Hono } from "hono";
import { db, articles, sources, articleGroups, blindspots } from "@open-bias/db";
import { eq, desc, and, sql, count, avg } from "drizzle-orm";
import { redis, CacheKeys, CacheTTL } from "./redis";

const app = new Hono();

// Development toggle - set to false for production to only show grouped stories
const SHOW_UNGROUPED_ARTICLES = true;

// Elasticsearch configuration
const ELASTIC_URL = process.env.ELASTIC_URL || 'http://localhost:9200';
const ELASTIC_INDEX = process.env.ELASTIC_INDEX || 'articles';

// Initialize Redis connection
redis.connect().then((connected) => {
  if (connected) {
    console.log('Redis caching enabled for stories API');
  } else {
    console.log('Redis unavailable, running without cache');
  }
});

// Get trending stories with coverage analysis
app.get("/api/stories/trending", async (c) => {
  try {
    const limit = Number(c.req.query("limit") || 20);
    const timeframe = c.req.query("timeframe") || "30d";
    const offset = Number(c.req.query("offset") || 0);
    const coverage = c.req.query("coverage") || "";
    
    // Try to get from cache first (only for first page)
    const cacheKey = CacheKeys.stories.trending(timeframe, limit);
    const shouldCache = false; // Disable cache for debugging
    
    const result = shouldCache 
      ? await redis.cache(cacheKey, async () => {
          return await fetchTrendingStories(timeframe, limit, offset, coverage);
        }, CacheTTL.MEDIUM)
      : await fetchTrendingStories(timeframe, limit, offset, coverage);

    return c.json({ 
      stories: result.stories,
      total: result.total,
      hasMore: result.stories.length === limit
    });
  } catch (error) {
    console.error("Error fetching trending stories:", error);
    return c.json({ error: "Failed to fetch trending stories" }, 500);
  }
});

async function fetchTrendingStories(timeframe: string, limit: number, offset: number = 0, coverage: string = "") {
  // Calculate date threshold based on timeframe - make it more lenient for development
  const hoursBack = timeframe === "1h" ? 1 : 
                   timeframe === "6h" ? 6 : 
                   timeframe === "24h" ? 24 : 
                   timeframe === "7d" ? 168 : 
                   720; // default to 30 days for development
                   
  const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  console.log(`📊 Fetching trending stories since: ${dateThreshold.toISOString()}`);

  // Get total count first
  const totalQuery = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${articleGroups.id})` })
    .from(articleGroups)
    .innerJoin(articles, eq(articles.groupId, articleGroups.id))
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(sql`${articles.published} >= ${dateThreshold}`)
    .having(sql`COUNT(${articles.id}) >= 1`);

  const total = Number(totalQuery[0]?.count || 0);

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
      // Get the first available image from any article in the group
      imageUrl: sql<string>`(
        SELECT ${articles.imageUrl} 
        FROM ${articles} 
        WHERE ${articles.groupId} = ${articleGroups.id} 
          AND ${articles.imageUrl} IS NOT NULL 
          AND ${articles.imageUrl} != '' 
          AND ${articles.imageUrl} != 'null'
        LIMIT 1
      )`,
    })
    .from(articleGroups)
    .innerJoin(articles, eq(articles.groupId, articleGroups.id))
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(sql`${articles.published} >= ${dateThreshold}`)
    .groupBy(articleGroups.id)
    .having(sql`COUNT(${articles.id}) >= 1`) // Allow single-source stories for development
    .orderBy(desc(sql`COUNT(${articles.id})`), desc(sql`MAX(${articles.published})`))
    .limit(limit)
    .offset(offset);

  console.log(`📊 Found ${rawStories.length} trending stories (offset: ${offset}, total: ${total})`);

  // Convert string numbers to actual numbers for frontend compatibility
  const stories = rawStories.map(story => ({
    ...story,
    totalArticles: Number(story.totalArticles),
    leftCoverage: Number(story.leftCoverage),
    centerCoverage: Number(story.centerCoverage),
    rightCoverage: Number(story.rightCoverage),
    coverageScore: Number(story.coverageScore),
  }));

  // If coverage=all is requested and toggle is enabled, also include ungrouped articles
  if (SHOW_UNGROUPED_ARTICLES && coverage === "all") {
    // Get recent ungrouped articles
    const ungroupedArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        imageUrl: articles.imageUrl,
        published: articles.published,
        sourceBias: sources.bias,
      })
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(and(
        sql`${articles.published} >= ${dateThreshold}`,
        sql`${articles.groupId} IS NULL`
      ))
      .orderBy(desc(articles.published))
      .limit(limit)
      .offset(offset);

    // Convert ungrouped articles to story format
    const ungroupedStories = ungroupedArticles.map((article, index) => {
      const bias = article.sourceBias || 'unknown';
      const leftCoverage = bias === 'left' ? 1 : 0;
      const centerCoverage = bias === 'center' ? 1 : 0;
      const rightCoverage = bias === 'right' ? 1 : 0;
      const coverageScore = bias === 'unknown' ? 0 : 33;

      return {
        id: `ungrouped_${article.id}`,
        title: article.title,
        neutralSummary: article.summary,
        totalArticles: 1,
        leftCoverage,
        centerCoverage,
        rightCoverage,
        coverageScore,
        firstReported: article.published,
        lastUpdated: article.published,
        mostUnbiasedArticleId: null,
        imageUrl: article.imageUrl && article.imageUrl !== 'null' ? article.imageUrl : null,
      };
    });

    // Mix grouped and ungrouped stories
    stories.push(...ungroupedStories);
  }

  return { stories, total };
}

// Search stories with advanced filters
app.get("/api/stories/search", async (c) => {
  try {
    const query = c.req.query("q") || "";
    const coverage = c.req.query("coverage") || "";
    const timeframe = c.req.query("timeframe") || "30d";
    const limit = Number(c.req.query("limit") || 20);
    const offset = Number(c.req.query("offset") || 0);

    // Try to get from cache first (only for first page)
    const cacheKey = CacheKeys.stories.search(query, timeframe, coverage, limit);
    const shouldCache = offset === 0; // Only cache first page
    
    const result = shouldCache 
      ? await redis.cache(cacheKey, async () => {
          return await searchStoriesInElasticsearch(query, coverage, timeframe, limit, offset);
        }, CacheTTL.SHORT)
      : await searchStoriesInElasticsearch(query, coverage, timeframe, limit, offset);

    return c.json({
      stories: result.stories,
      total: result.total,
      aggregations: result.aggregations,
      hasMore: result.stories.length === limit && (offset + limit) < result.total,
    });
  } catch (error) {
    console.error("Error searching stories:", error);
    return c.json({ error: "Failed to search stories" }, 500);
  }
});

// Get story details with all articles and bias analysis
app.get("/api/stories/:id", async (c) => {
  try {
    const storyIdParam = c.req.param('id');
    const storyId = Number(storyIdParam);
    
    // Validate storyId
    if (isNaN(storyId) || storyId <= 0) {
      return c.json({ error: "Invalid story ID" }, 400);
    }
    
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

// Get analytics overview for dashboard metrics
app.get("/api/analytics/overview", async (c) => {
  try {
    const timeframe = c.req.query("timeframe") || "30d";
    const hoursBack = timeframe === "1h" ? 1 : 
                     timeframe === "6h" ? 6 : 
                     timeframe === "24h" ? 24 : 
                     timeframe === "7d" ? 168 : 
                     720; // 30 days
    const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Get total active stories (story groups)
    const [totalStoriesResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${articleGroups.id})` })
      .from(articleGroups)
      .innerJoin(articles, eq(articles.groupId, articleGroups.id))
      .where(sql`${articles.published} >= ${dateThreshold}`);

    const totalStories = Number(totalStoriesResult?.count || 0);

    // Get coverage statistics by calculating bias coverage per group
    const coverageResults = await db
      .select({
        groupId: articleGroups.id,
        leftCount: sql<number>`SUM(CASE WHEN ${sources.bias} = 'left' THEN 1 ELSE 0 END)`,
        centerCount: sql<number>`SUM(CASE WHEN ${sources.bias} = 'center' THEN 1 ELSE 0 END)`,
        rightCount: sql<number>`SUM(CASE WHEN ${sources.bias} = 'right' THEN 1 ELSE 0 END)`,
      })
      .from(articleGroups)
      .innerJoin(articles, eq(articles.groupId, articleGroups.id))
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(sql`${articles.published} >= ${dateThreshold}`)
      .groupBy(articleGroups.id);

    // Calculate average coverage percentage and detect blindspots
    let totalCoverageScore = 0;
    let validGroups = 0;
    let blindspotCount = 0;

    coverageResults.forEach(group => {
      const left = Number(group.leftCount || 0);
      const center = Number(group.centerCount || 0);
      const right = Number(group.rightCount || 0);
      
      const biasTypes = (left > 0 ? 1 : 0) + (center > 0 ? 1 : 0) + (right > 0 ? 1 : 0);
      const coveragePercentage = Math.round((biasTypes / 3) * 100);
      
      // Count as blindspot if missing any perspective (less than full coverage)
      if (biasTypes < 3 && biasTypes > 0) {
        blindspotCount++;
      }
      
      totalCoverageScore += coveragePercentage;
      validGroups++;
    });

    const averageCoverage = validGroups > 0 ? Math.round(totalCoverageScore / validGroups) : 0;

    return c.json({
      totalStories,
      averageCoverage,
      blindspotCount,
      timeframe
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    return c.json({ error: "Failed to fetch analytics overview" }, 500);
  }
});

// Get detailed blindspot information
app.get("/api/analytics/blindspots", async (c) => {
  try {
    const timeframe = c.req.query("timeframe") || "30d";
    const hoursBack = timeframe === "1h" ? 1 : 
                     timeframe === "6h" ? 6 : 
                     timeframe === "24h" ? 24 : 
                     timeframe === "7d" ? 168 : 
                     720; // 30 days
    const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Get coverage statistics by calculating bias coverage per group
    const coverageResults = await db
      .select({
        groupId: articleGroups.id,
        groupName: articleGroups.name,
        leftCount: sql<number>`SUM(CASE WHEN ${sources.bias} = 'left' THEN 1 ELSE 0 END)`,
        centerCount: sql<number>`SUM(CASE WHEN ${sources.bias} = 'center' THEN 1 ELSE 0 END)`,
        rightCount: sql<number>`SUM(CASE WHEN ${sources.bias} = 'right' THEN 1 ELSE 0 END)`,
        totalArticles: sql<number>`COUNT(${articles.id})`,
        firstReported: sql<Date>`MIN(${articles.published})`,
        lastUpdated: sql<Date>`MAX(${articles.published})`,
      })
      .from(articleGroups)
      .innerJoin(articles, eq(articles.groupId, articleGroups.id))
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(sql`${articles.published} >= ${dateThreshold}`)
      .groupBy(articleGroups.id, articleGroups.name);

    // Identify stories with coverage gaps
    const blindspots = coverageResults
      .map(group => {
        const left = Number(group.leftCount || 0);
        const center = Number(group.centerCount || 0);
        const right = Number(group.rightCount || 0);
        
        const biasTypes = (left > 0 ? 1 : 0) + (center > 0 ? 1 : 0) + (right > 0 ? 1 : 0);
        
        // Only include if there's a coverage gap (missing at least one perspective)
        if (biasTypes < 3 && biasTypes > 0) {
          const missingPerspectives = [];
          if (left === 0) missingPerspectives.push('left');
          if (center === 0) missingPerspectives.push('center');
          if (right === 0) missingPerspectives.push('right');
          
          const coveragePercentage = Math.round((biasTypes / 3) * 100);
          
          return {
            groupId: group.groupId,
            title: group.groupName,
            coveragePercentage,
            totalArticles: Number(group.totalArticles),
            missingPerspectives,
            currentCoverage: {
              left: left,
              center: center,
              right: right
            },
            firstReported: group.firstReported,
            lastUpdated: group.lastUpdated,
            severity: biasTypes === 1 ? 'high' : 'medium' // High if only one perspective, medium if two
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.coveragePercentage - b.coveragePercentage); // Sort by lowest coverage first

    return c.json({
      blindspots,
      totalBlindspots: blindspots.length,
      timeframe
    });
  } catch (error) {
    console.error("Error fetching blindspot details:", error);
    return c.json({ error: "Failed to fetch blindspot details" }, 500);
  }
});

async function searchStoriesInElasticsearch(query: string, coverage: string, timeframe: string, limit: number, offset: number = 0) {
  let searchQuery: any = {
    bool: {
      must: [] as Record<string, unknown>[],
      filter: [] as Record<string, unknown>[],
      should: [] as Record<string, unknown>[],
      minimum_should_match: 0,
    }
  };

  if (query) {
    searchQuery.bool.must.push({
      multi_match: {
        query,
        fields: ["title^2", "summary", "neutralSummary"],
        type: "best_fields"
      }
    });
  } else {
    searchQuery.bool.must.push({ match_all: {} });
  }

  // Add time filter - make it more lenient for development
  const hoursBack = timeframe === "24h" ? 24 : 
                   timeframe === "7d" ? 168 : 
                   720; // 30 days for development
  const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  // Temporarily disable date filtering for debugging
  // searchQuery.bool.filter.push({
  //   range: {
  //     published: {
  //       gte: dateThreshold.toISOString(),
  //     }
  //   }
  // });

  console.log(`🔍 Searching Elasticsearch with query: ${JSON.stringify(searchQuery)}`);

  // Search in Elasticsearch
  const response = await fetch(`${ELASTIC_URL}/${ELASTIC_INDEX}/_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: searchQuery,
      from: offset,
      size: limit * 3, // Get more articles to account for grouping
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

  if (!response.ok) {
    throw new Error(`Elasticsearch search failed: ${response.status}`);
  }

  const results = await response.json();
  console.log(`🔍 Elasticsearch returned ${results.hits.total.value} articles`);

  // If Elasticsearch returns no results, fall back to database search
  if (results.hits.total.value === 0 && query) {
    console.log(`🔍 No Elasticsearch results for "${query}", falling back to database search`);
    return await searchStoriesInDatabase(query, coverage, timeframe, limit, offset);
  }

  // Group articles by story
  const groupedArticles = new Map();
  const ungroupedArticles = [];
  
  for (const hit of results.hits.hits) {
    const article = hit._source;
    const groupId = article.groupId;
    
    // Handle ungrouped articles - only include if coverage is "all" and toggle is enabled
    if (!groupId) {
      if (SHOW_UNGROUPED_ARTICLES && coverage === "all") {
        ungroupedArticles.push(article);
      }
      continue;
    }
    
    if (!groupedArticles.has(groupId)) {
      groupedArticles.set(groupId, {
        id: groupId,
        title: article.title,
        neutralSummary: article.summary,
        articles: [],
        biases: new Set(),
        firstReported: new Date(article.published),
        lastUpdated: new Date(article.published),
        imageUrl: null,
      });
    }
    
    const story = groupedArticles.get(groupId);
    story.articles.push(article);
    story.biases.add(article.sourceBias);
    
    // Update timestamps
    const articleDate = new Date(article.published);
    if (articleDate < story.firstReported) story.firstReported = articleDate;
    if (articleDate > story.lastUpdated) story.lastUpdated = articleDate;
    
    // Set image if available
    if (!story.imageUrl && article.imageUrl && article.imageUrl !== 'null') {
      story.imageUrl = article.imageUrl;
    }
  }

  // Convert grouped articles to stories format
  const stories = Array.from(groupedArticles.values()).map(story => {
    const leftCoverage = story.articles.filter((a: any) => a.sourceBias === 'left').length;
    const centerCoverage = story.articles.filter((a: any) => a.sourceBias === 'center').length;
    const rightCoverage = story.articles.filter((a: any) => a.sourceBias === 'right').length;
    const coverageScore = Math.round((story.biases.size / 3) * 100);

    return {
      id: story.id,
      title: story.title,
      neutralSummary: story.neutralSummary,
      totalArticles: story.articles.length,
      leftCoverage,
      centerCoverage,
      rightCoverage,
      coverageScore,
      firstReported: story.firstReported,
      lastUpdated: story.lastUpdated,
      mostUnbiasedArticleId: null,
      imageUrl: story.imageUrl,
    };
  });

  // Add ungrouped articles as individual stories only if toggle is enabled and coverage is "all"
  const ungroupedStories = (SHOW_UNGROUPED_ARTICLES && coverage === "all") ? 
    ungroupedArticles.map((article, index) => {
      const bias = article.sourceBias || 'unknown';
      const leftCoverage = bias === 'left' ? 1 : 0;
      const centerCoverage = bias === 'center' ? 1 : 0;
      const rightCoverage = bias === 'right' ? 1 : 0;
      const coverageScore = bias === 'unknown' ? 0 : 33; // Single perspective = 33%

      return {
        id: `ungrouped_${article.id || index}`, // Use article ID or index for unique identifier
        title: article.title,
        neutralSummary: article.summary,
        totalArticles: 1,
        leftCoverage,
        centerCoverage,
        rightCoverage,
        coverageScore,
        firstReported: new Date(article.published),
        lastUpdated: new Date(article.published),
        mostUnbiasedArticleId: null,
        imageUrl: article.imageUrl && article.imageUrl !== 'null' ? article.imageUrl : null,
      };
    }) : [];

  // Combine grouped and ungrouped stories
  const allStories = [...stories, ...ungroupedStories];

  // Apply coverage filter
  let filteredStories = allStories;
  if (coverage === "full") {
    filteredStories = allStories.filter(s => s.coverageScore >= 100);
  } else if (coverage === "partial") {
    filteredStories = allStories.filter(s => s.coverageScore >= 50 && s.coverageScore < 100);
  } else if (coverage === "limited") {
    filteredStories = allStories.filter(s => s.coverageScore < 50);
  }

  return {
    stories: filteredStories.slice(0, limit),
    total: filteredStories.length,
    aggregations: results.aggregations,
  };
}

async function searchStoriesInDatabase(query: string, coverage: string, timeframe: string, limit: number, offset: number = 0) {
  console.log(`🗄️ Searching database for: "${query}"`);
  
  // Calculate date threshold
  const hoursBack = timeframe === "24h" ? 24 : 
                   timeframe === "7d" ? 168 : 
                   720; // 30 days for development
  const dateThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  // Search in article groups first
  const groupedStories = await db
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
      imageUrl: sql<string>`(
        SELECT ${articles.imageUrl} 
        FROM ${articles} 
        WHERE ${articles.groupId} = ${articleGroups.id} 
          AND ${articles.imageUrl} IS NOT NULL 
          AND ${articles.imageUrl} != '' 
          AND ${articles.imageUrl} != 'null'
        LIMIT 1
      )`,
    })
    .from(articleGroups)
    .innerJoin(articles, eq(articles.groupId, articleGroups.id))
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(and(
      sql`${articleGroups.name} LIKE ${`%${query}%`}`,
      sql`${articles.published} >= ${dateThreshold}`
    ))
    .groupBy(articleGroups.id)
    .having(sql`COUNT(${articles.id}) >= 1`)
    .orderBy(desc(sql`COUNT(${articles.id})`), desc(sql`MAX(${articles.published})`))
    .limit(limit)
    .offset(offset);

  const stories = groupedStories.map(story => ({
    ...story,
    totalArticles: Number(story.totalArticles),
    leftCoverage: Number(story.leftCoverage),
    centerCoverage: Number(story.centerCoverage),
    rightCoverage: Number(story.rightCoverage),
    coverageScore: Number(story.coverageScore),
  }));

  // Also search ungrouped articles if coverage is "all"
  let ungroupedStories: any[] = [];
  if (SHOW_UNGROUPED_ARTICLES && coverage === "all") {
    const ungroupedArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        summary: articles.summary,
        imageUrl: articles.imageUrl,
        published: articles.published,
        sourceBias: sources.bias,
      })
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(and(
        sql`${articles.title} LIKE ${`%${query}%`}`,
        sql`${articles.published} >= ${dateThreshold}`,
        sql`${articles.groupId} IS NULL`
      ))
      .orderBy(desc(articles.published))
      .limit(limit)
      .offset(offset);

    ungroupedStories = ungroupedArticles.map((article) => {
      const bias = article.sourceBias || 'unknown';
      const leftCoverage = bias === 'left' ? 1 : 0;
      const centerCoverage = bias === 'center' ? 1 : 0;
      const rightCoverage = bias === 'right' ? 1 : 0;
      const coverageScore = bias === 'unknown' ? 0 : 33;

      return {
        id: `ungrouped_${article.id}`,
        title: article.title,
        neutralSummary: article.summary,
        totalArticles: 1,
        leftCoverage,
        centerCoverage,
        rightCoverage,
        coverageScore,
        firstReported: article.published,
        lastUpdated: article.published,
        mostUnbiasedArticleId: null,
        imageUrl: article.imageUrl && article.imageUrl !== 'null' ? article.imageUrl : null,
      };
    });
  }

  const allStories = [...stories, ...ungroupedStories];

  // Apply coverage filter
  let filteredStories = allStories;
  if (coverage === "full") {
    filteredStories = allStories.filter(s => s.coverageScore >= 100);
  } else if (coverage === "partial") {
    filteredStories = allStories.filter(s => s.coverageScore >= 50 && s.coverageScore < 100);
  } else if (coverage === "limited") {
    filteredStories = allStories.filter(s => s.coverageScore < 50);
  }

  console.log(`🗄️ Database search found ${filteredStories.length} results`);

  return {
    stories: filteredStories.slice(0, limit),
    total: filteredStories.length,
    aggregations: {},
  };
}

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

// Analyze story for detailed insights
app.post("/api/stories/:id/analyze", async (c) => {
  try {
    const storyId = Number(c.req.param('id'));
    
    // Get story and articles
    const story = await db.query.articleGroups.findFirst({
      where: eq(articleGroups.id, storyId),
    });

    if (!story) {
      return c.json({ error: "Story not found" }, 404);
    }

    const storyArticles = await db
      .select({
        title: articles.title,
        summary: articles.summary,
        sourceName: sources.name,
        sourceBias: sources.bias,
        politicalLeaning: articles.politicalLeaning,
        sensationalism: articles.sensationalism,
        framingSummary: articles.framingSummary,
      })
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(eq(articles.groupId, storyId));

    // Generate comprehensive analysis
    const analysisText = generateStoryAnalysis(story, storyArticles);

    return c.json({
      analysis: analysisText,
      storyId,
      analysisTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error analyzing story:", error);
    return c.json({ error: "Failed to analyze story" }, 500);
  }
});

// Helper function to generate detailed story analysis
function generateStoryAnalysis(story: any, storyArticles: any[]): string {
  const biasDistribution = storyArticles.reduce((acc, article) => {
    const bias = article.sourceBias || 'unknown';
    acc[bias] = (acc[bias] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalArticles = storyArticles.length;
  const perspectives = Object.keys(biasDistribution).filter(k => k !== 'unknown').length;
  const coverageScore = Math.round((perspectives / 3) * 100);

  const avgPoliticalLeaning = storyArticles
    .filter(a => a.politicalLeaning !== null)
    .reduce((sum, a) => sum + parseFloat(a.politicalLeaning), 0) / storyArticles.filter(a => a.politicalLeaning !== null).length;

  const avgSensationalism = storyArticles
    .filter(a => a.sensationalism !== null)
    .reduce((sum, a) => sum + parseFloat(a.sensationalism), 0) / storyArticles.filter(a => a.sensationalism !== null).length;

  let analysis = `## Comprehensive Analysis: ${story.name}\n\n`;
  
  analysis += `This story has been covered by ${totalArticles} sources across ${perspectives} political perspectives, `;
  analysis += `achieving a coverage score of ${coverageScore}%. `;
  
  if (coverageScore === 100) {
    analysis += `This represents excellent cross-spectrum coverage, providing readers with comprehensive viewpoints from left, center, and right-leaning sources.\n\n`;
  } else if (coverageScore >= 67) {
    analysis += `This provides good coverage across political perspectives, though one viewpoint may be underrepresented.\n\n`;
  } else {
    analysis += `This story shows limited perspective diversity, potentially creating blindspots in coverage.\n\n`;
  }

  // Bias analysis
  if (!isNaN(avgPoliticalLeaning)) {
    analysis += `### Political Leaning Analysis\n`;
    if (avgPoliticalLeaning > 0.3) {
      analysis += `The overall coverage leans conservative (${avgPoliticalLeaning.toFixed(2)}), with sources generally framing the story in ways that align with right-leaning perspectives.\n\n`;
    } else if (avgPoliticalLeaning < -0.3) {
      analysis += `The overall coverage leans liberal (${avgPoliticalLeaning.toFixed(2)}), with sources generally framing the story in ways that align with left-leaning perspectives.\n\n`;
    } else {
      analysis += `The overall coverage appears relatively balanced (${avgPoliticalLeaning.toFixed(2)}), with sources providing centrist framing of the events.\n\n`;
    }
  }

  // Sensationalism analysis
  if (!isNaN(avgSensationalism)) {
    analysis += `### Sensationalism Assessment\n`;
    const sensationalismPercent = Math.round(avgSensationalism * 100);
    if (sensationalismPercent > 70) {
      analysis += `Coverage shows high sensationalism (${sensationalismPercent}%), with sources using emotionally charged language and dramatic framing.\n\n`;
    } else if (sensationalismPercent > 40) {
      analysis += `Coverage shows moderate sensationalism (${sensationalismPercent}%), balancing engaging presentation with factual reporting.\n\n`;
    } else {
      analysis += `Coverage maintains low sensationalism (${sensationalismPercent}%), focusing on factual presentation over emotional engagement.\n\n`;
    }
  }

  // Source distribution
  analysis += `### Source Distribution\n`;
  Object.entries(biasDistribution).forEach(([bias, count]) => {
    if (bias !== 'unknown') {
      const percentage = Math.round(((count as number) / totalArticles) * 100);
      analysis += `- ${bias.charAt(0).toUpperCase() + bias.slice(1)}: ${count} sources (${percentage}%)\n`;
    }
  });

  analysis += `\n### Key Insights\n`;
  analysis += `Based on the analysis of coverage patterns, this story represents a significant news event that has captured attention across the political spectrum. `;
  analysis += `The distribution of sources and their framing approaches provides insight into how different audiences might perceive and understand these developments.\n\n`;
  
  analysis += `Readers are encouraged to consider multiple perspectives when forming their understanding of this story, `;
  analysis += `particularly noting how different sources emphasize various aspects of the underlying events.`;

  return analysis;
}

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
