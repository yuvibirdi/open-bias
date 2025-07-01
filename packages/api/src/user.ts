import { Hono } from "hono";
import { authMiddleware } from "./auth";
import { 
  db, 
  userArticleRatings, 
  blindspots, 
  articleGroups, 
  articles, 
  storyCoverage,
  users 
} from "@open-bias/db";
import { eq, desc, and, gte } from "drizzle-orm";

const userApp = new Hono();

// Get user's blindspots
userApp.get("/blindspots", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;

    const userBlindspots = await db
      .select({
        id: blindspots.id,
        groupId: blindspots.groupId,
        blindspotType: blindspots.blindspotType,
        severity: blindspots.severity,
        description: blindspots.description,
        suggestedSources: blindspots.suggestedSources,
        dismissed: blindspots.dismissed,
        createdAt: blindspots.createdAt,
        groupTitle: articleGroups.name,
        groupSummary: articleGroups.neutralSummary,
      })
      .from(blindspots)
      .innerJoin(articleGroups, eq(blindspots.groupId, articleGroups.id))
      .where(and(
        eq(blindspots.userId, userId),
        eq(blindspots.dismissed, 0)
      ))
      .orderBy(desc(blindspots.createdAt))
      .limit(50);

    return c.json({ blindspots: userBlindspots });
  } catch (error) {
    console.error("Get blindspots error:", error);
    return c.json({ error: "Failed to get blindspots" }, 500);
  }
});

// Dismiss a blindspot
userApp.put("/blindspots/:id/dismiss", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;
    const blindspotId = parseInt(c.req.param("id"));

    await db
      .update(blindspots)
      .set({ dismissed: 1 })
      .where(and(
        eq(blindspots.id, blindspotId),
        eq(blindspots.userId, userId)
      ));

    return c.json({ success: true });
  } catch (error) {
    console.error("Dismiss blindspot error:", error);
    return c.json({ error: "Failed to dismiss blindspot" }, 500);
  }
});

// Rate an article
userApp.post("/rate-article", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;
    const { articleId, biasRating, qualityRating } = await c.req.json();

    // Check if user already rated this article
    const existingRating = await db.query.userArticleRatings.findFirst({
      where: and(
        eq(userArticleRatings.userId, userId),
        eq(userArticleRatings.articleId, articleId)
      ),
    });

    if (existingRating) {
      // Update existing rating
      await db
        .update(userArticleRatings)
        .set({
          biasRating: biasRating?.toString(),
          qualityRating,
        })
        .where(eq(userArticleRatings.id, existingRating.id));
    } else {
      // Create new rating
      await db
        .insert(userArticleRatings)
        .values({
          userId,
          articleId,
          biasRating: biasRating?.toString(),
          qualityRating,
        });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Rate article error:", error);
    return c.json({ error: "Failed to rate article" }, 500);
  }
});

// Get user's article ratings
userApp.get("/ratings", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;
    const limit = parseInt(c.req.query("limit") || "20");

    const ratings = await db
      .select({
        id: userArticleRatings.id,
        articleId: userArticleRatings.articleId,
        biasRating: userArticleRatings.biasRating,
        qualityRating: userArticleRatings.qualityRating,
        createdAt: userArticleRatings.createdAt,
        articleTitle: articles.title,
        articleLink: articles.link,
      })
      .from(userArticleRatings)
      .innerJoin(articles, eq(userArticleRatings.articleId, articles.id))
      .where(eq(userArticleRatings.userId, userId))
      .orderBy(desc(userArticleRatings.createdAt))
      .limit(limit);

    return c.json({ ratings });
  } catch (error) {
    console.error("Get ratings error:", error);
    return c.json({ error: "Failed to get ratings" }, 500);
  }
});

// Get personalized recommendations
userApp.get("/recommendations", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;

    // Get user's bias preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { preferences: true },
    });

    // Use the preferences for filtering/recommendations logic here if needed
    console.log('User preferences loaded for recommendations:', user?.preferences);

    // Find stories with potential blindspots for this user
    const recommendations = await db
      .select({
        groupId: articleGroups.id,
        groupName: articleGroups.name,
        neutralSummary: articleGroups.neutralSummary,
        leftCoverage: storyCoverage.leftCoverage,
        centerCoverage: storyCoverage.centerCoverage,
        rightCoverage: storyCoverage.rightCoverage,
        coverageScore: storyCoverage.coverageScore,
        totalCoverage: storyCoverage.totalCoverage,
      })
      .from(articleGroups)
      .innerJoin(storyCoverage, eq(articleGroups.id, storyCoverage.groupId))
      .where(gte(storyCoverage.coverageScore, "50")) // Only well-covered stories
      .orderBy(desc(storyCoverage.lastUpdated))
      .limit(20);

    // Add blindspot information
    const enrichedRecommendations = recommendations.map((rec) => {
      const missingPerspectives = [];
      if (rec.leftCoverage === 0) missingPerspectives.push('left');
      if (rec.centerCoverage === 0) missingPerspectives.push('center');
      if (rec.rightCoverage === 0) missingPerspectives.push('right');

      return {
        ...rec,
        missingPerspectives,
        hasBlindspot: missingPerspectives.length > 0,
      };
    });

    return c.json({ recommendations: enrichedRecommendations });
  } catch (error) {
    console.error("Get recommendations error:", error);
    return c.json({ error: "Failed to get recommendations" }, 500);
  }
});

// Get user reading history
userApp.get("/reading-history", authMiddleware, async (c) => {
  try {
    // This would need a reading_history table in a real implementation
    // For now, return empty array
    return c.json({ history: [] });
  } catch (error) {
    console.error("Get reading history error:", error);
    return c.json({ error: "Failed to get reading history" }, 500);
  }
});

export default userApp;
