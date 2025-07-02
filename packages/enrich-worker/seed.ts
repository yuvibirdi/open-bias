#!/usr/bin/env bun
/**
 * Database Seeding Script
 * -----------------------
 * Seeds the database with initial RSS sources
 */

import { seedSources } from "@open-bias/db/src/seedSources";

async function main() {
  console.log("🌱 Seeding database with RSS sources...\n");
  
  try {
    await seedSources();
    console.log("\n✅ Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Database seeding failed:", error);
    process.exit(1);
  }
}

main();
