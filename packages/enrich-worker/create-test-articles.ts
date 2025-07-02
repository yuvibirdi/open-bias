#!/usr/bin/env bun
/**
 * Create Test Articles Script
 * ----------------------------
 * Creates sample articles for testing the grouping and analysis system
 */

import { db, articles, sources } from "@open-bias/db";

const testArticles = [
  {
    title: "President Announces New Climate Policy Initiative",
    summary: "The White House unveiled a comprehensive climate change policy package aimed at reducing carbon emissions by 50% over the next decade. The initiative includes investments in renewable energy, electric vehicle infrastructure, and green job creation programs.",
    sourceId: 1, // Associated Press
    link: "https://example.com/article1",
    published: new Date("2024-01-15T10:00:00Z")
  },
  {
    title: "Biden Administration Unveils Ambitious Climate Plan",
    summary: "President Biden announced sweeping climate reforms today, targeting a 50% reduction in greenhouse gas emissions. The plan encompasses renewable energy expansion, EV charging networks, and sustainable employment opportunities.",
    sourceId: 6, // CNN
    link: "https://example.com/article2", 
    published: new Date("2024-01-15T11:30:00Z")
  },
  {
    title: "New Climate Initiative Faces Republican Opposition",
    summary: "Conservative lawmakers criticized the administration's latest climate proposal, arguing it will harm the economy and eliminate traditional energy jobs. Republicans vow to challenge the legislation in Congress.",
    sourceId: 7, // Fox News
    link: "https://example.com/article3",
    published: new Date("2024-01-15T12:00:00Z")
  },
  {
    title: "Tech Giant Reports Record Quarterly Earnings",
    summary: "A major technology company announced record-breaking profits for Q4, driven by strong cloud computing and AI services demand. Shares jumped 8% in after-hours trading following the earnings announcement.",
    sourceId: 2, // Reuters
    link: "https://example.com/article4",
    published: new Date("2024-01-16T09:00:00Z")
  },
  {
    title: "Silicon Valley Company Exceeds Profit Expectations",
    summary: "The tech sector leader surprised investors with exceptional fourth-quarter results, citing robust demand for artificial intelligence and cloud infrastructure. Stock prices surged on the positive earnings report.",
    sourceId: 8, // The Guardian
    link: "https://example.com/article5",
    published: new Date("2024-01-16T10:15:00Z")
  },
  {
    title: "Federal Reserve Considers Interest Rate Changes",
    summary: "Central bank officials are weighing potential adjustments to monetary policy amid changing economic conditions. The decision will impact borrowing costs for consumers and businesses nationwide.",
    sourceId: 3, // BBC News
    link: "https://example.com/article6",
    published: new Date("2024-01-17T14:00:00Z")
  }
];

async function createTestArticles() {
  console.log("📰 Creating test articles for grouping and analysis...\n");
  
  try {
    // Check if test articles already exist
    const existingCount = await db.select().from(articles);
    console.log(`Found ${existingCount.length} existing articles in database`);
    
    if (existingCount.length >= 10) {
      console.log("✅ Sufficient articles already exist for testing");
      return;
    }
    
    // Insert test articles
    for (const article of testArticles) {
      try {
        await db.insert(articles).values({
          title: article.title,
          summary: article.summary,
          sourceId: article.sourceId,
          link: article.link,
          published: article.published,
          indexed: 0,
          bias: 'unknown'
        });
        
        console.log(`✅ Created: "${article.title.substring(0, 50)}..."`);
      } catch (error) {
        // Article might already exist, which is fine
        console.log(`⚠️ Skipped: "${article.title.substring(0, 50)}..." (might already exist)`);
      }
    }
    
    const newCount = await db.select().from(articles);
    console.log(`\n📊 Total articles in database: ${newCount.length}`);
    console.log("✅ Test articles created successfully!");
    
  } catch (error) {
    console.error("❌ Failed to create test articles:", error);
    throw error;
  }
}

async function main() {
  try {
    await createTestArticles();
    process.exit(0);
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }
}

main();
