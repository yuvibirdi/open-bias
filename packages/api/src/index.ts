import { db, articles } from "@open-bias/db";
import { sql } from "drizzle-orm";

const recent = await db
  .select()
  .from(articles)
  .limit(10)
  .orderBy(sql`${articles.published} DESC`);

console.log(recent); // Use the variable to avoid lint error