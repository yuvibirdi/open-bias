import { Hono } from "hono";
import { authMiddleware } from "./auth";
import { 
  db, 
  blindspots, 
  articleGroups
} from "@open-bias/db";
import { eq, desc, and, sql } from "drizzle-orm";

const notificationApp = new Hono();

// Helper function to get unread blindspot count
async function getUnreadBlindspotCount(userId: number): Promise<number> {
  try {
    const count = await db
      .select({ count: sql`COUNT(*)`.as('count') })
      .from(blindspots)
      .where(and(
        eq(blindspots.userId, userId),
        eq(blindspots.dismissed, 0)
      ));
    
    return (count[0] as { count: number })?.count || 0;
  } catch (error) {
    console.error('Error getting blindspot count:', error);
    return 0;
  }
}

// REST endpoint to get notifications
notificationApp.get("/list", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;

    // Get recent blindspots as notifications
    const notifications = await db
      .select({
        id: blindspots.id,
        type: blindspots.blindspotType,
        description: blindspots.description,
        severity: blindspots.severity,
        createdAt: blindspots.createdAt,
        groupId: blindspots.groupId,
        groupName: articleGroups.name,
      })
      .from(blindspots)
      .innerJoin(articleGroups, eq(blindspots.groupId, articleGroups.id))
      .where(and(
        eq(blindspots.userId, userId),
        eq(blindspots.dismissed, 0)
      ))
      .orderBy(desc(blindspots.createdAt))
      .limit(20);

    const count = await getUnreadBlindspotCount(userId);

    return c.json({ notifications, unreadCount: count });
  } catch (error) {
    console.error("Get notifications error:", error);
    return c.json({ error: "Failed to get notifications" }, 500);
  }
});

// Mark notification as read
notificationApp.put("/read/:id", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;
    const notificationId = parseInt(c.req.param("id"));

    await db
      .update(blindspots)
      .set({ dismissed: 1 })
      .where(and(
        eq(blindspots.id, notificationId),
        eq(blindspots.userId, userId)
      ));

    return c.json({ success: true });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return c.json({ error: "Failed to mark notification as read" }, 500);
  }
});

// Get notification count only
notificationApp.get("/count", authMiddleware, async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.userId;

    const count = await getUnreadBlindspotCount(userId);

    return c.json({ count });
  } catch (error) {
    console.error("Get notification count error:", error);
    return c.json({ error: "Failed to get notification count" }, 500);
  }
});

export default notificationApp;
