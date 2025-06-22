import { db, sources, biasEnum, type InsertSource, poolConnection, articles } from './index';
import { eq, and, or, isNull, ne, type SQL } from 'drizzle-orm'; // Import necessary operators

const initialSources: Omit<InsertSource, 'id' | 'fetchedAt'>[] = [
  {
    name: 'Associated Press',
    url: 'https://apnews.com',
    rss: 'https://feeds.apnews.com/rss/apf-topnews',
    bias: biasEnum.center,
  },
  {
    name: 'Reuters',
    url: 'https://www.reuters.com',
    rss: 'https://feeds.reuters.com/reuters/topNews',
    bias: biasEnum.center,
  },
  {
    name: 'BBC News',
    url: 'https://www.bbc.com/news',
    rss: 'http://feeds.bbci.co.uk/news/rss.xml',
    bias: biasEnum.center,
  },
  {
    name: 'NPR',
    url: 'https://www.npr.org',
    rss: 'https://feeds.npr.org/1001/rss.xml',
    bias: biasEnum.left,
  },
  {
    name: 'Al Jazeera English',
    url: 'https://www.aljazeera.com',
    rss: 'https://www.aljazeera.com/xml/rss/all.xml',
    bias: biasEnum.center,
  },
  {
    name: 'CNN',
    url: 'https://www.cnn.com',
    rss: 'http://rss.cnn.com/rss/edition.rss',
    bias: biasEnum.left,
  },
  {
    name: 'Fox News',
    url: 'https://www.foxnews.com',
    rss: 'http://feeds.foxnews.com/foxnews/latest',
    bias: biasEnum.right,
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com',
    rss: 'https://www.theguardian.com/world/rss',
    bias: biasEnum.left,
  },
  {
    name: 'Daily Wire',
    url: 'https://www.dailywire.com',
    rss: 'https://www.dailywire.com/feeds/rss.xml',
    bias: biasEnum.right,
  },
  {
    name: 'Politico',
    url: 'https://www.politico.com',
    rss: 'https://www.politico.com/rss/politicopicks.xml',
    bias: biasEnum.center,
  }
];

async function seedDatabase() {
  console.log('Starting source seeding and article bias correction process...');

  for (const seedSrc of initialSources) {
    if (seedSrc.bias === undefined || seedSrc.bias === null) {
      console.warn(`Seed data for "${seedSrc.name}" (RSS: ${seedSrc.rss}) is missing a bias. Skipping this source.`);
      continue;
    }

    const existingSource = await db.query.sources.findFirst({
      where: eq(sources.rss, seedSrc.rss),
      columns: { id: true, bias: true, name: true, url: true }
    });

    let currentSourceBiasInDB: number | null | undefined = undefined;
    let sourceIdToProcess: number | undefined = undefined;

    if (existingSource) {
      sourceIdToProcess = existingSource.id;
      currentSourceBiasInDB = existingSource.bias;

      // Update source name or URL if they differ
      if (existingSource.name !== seedSrc.name || existingSource.url !== seedSrc.url) {
        console.log(`Source "${existingSource.name}" (ID: ${existingSource.id}) metadata differs. Updating name/URL.`);
        await db.update(sources)
          .set({ name: seedSrc.name, url: seedSrc.url })
          .where(eq(sources.id, existingSource.id));
      }
      
      // Update source bias if DB bias is unknown/null and seed bias is known
      if ((currentSourceBiasInDB === biasEnum.unknown || currentSourceBiasInDB === null) && 
          seedSrc.bias !== biasEnum.unknown) {
        console.log(`Source "${seedSrc.name}" (ID: ${existingSource.id}) has unknown/null bias in DB. Updating to ${seedSrc.bias} from seed data.`);
        await db.update(sources)
          .set({ bias: seedSrc.bias })
          .where(eq(sources.id, existingSource.id));
        currentSourceBiasInDB = seedSrc.bias; // Reflect the update for subsequent article processing
      } else if (currentSourceBiasInDB !== seedSrc.bias && seedSrc.bias !== biasEnum.unknown) {
        // DB bias is known but different from seed bias (and seed bias is not unknown)
        console.log(`Source "${seedSrc.name}" (ID: ${existingSource.id}) bias in DB (${currentSourceBiasInDB}) differs from seed data (${seedSrc.bias}). Updating to seed data bias.`);
        await db.update(sources)
          .set({ bias: seedSrc.bias })
          .where(eq(sources.id, existingSource.id));
        currentSourceBiasInDB = seedSrc.bias;
      } else {
        console.log(`Source "${seedSrc.name}" (ID: ${existingSource.id}) bias in DB (${currentSourceBiasInDB}) is already consistent with seed data or seed data bias is unknown. No source bias update needed.`);
      }
    } else {
      // Source does not exist, insert it
      if (seedSrc.bias !== biasEnum.unknown) { // Only insert if seed bias is known
        console.log(`Inserting new source: "${seedSrc.name}" (RSS: ${seedSrc.rss}) with bias ${seedSrc.bias}.`);
        const newSourceResult = await db.insert(sources).values(seedSrc as InsertSource);
        // Assuming MySQL returns insertId in a way Drizzle can get or we might need to query back
        // For now, we'll query back by RSS to get the ID for article processing if needed.
        const inserted = await db.query.sources.findFirst({ where: eq(sources.rss, seedSrc.rss), columns: { id: true } });
        if (inserted) {
            sourceIdToProcess = inserted.id;
            currentSourceBiasInDB = seedSrc.bias;
        } else {
            console.error(`Failed to retrieve ID for newly inserted source "${seedSrc.name}". Skipping article processing for it.`);
        }
      } else {
        console.log(`Skipping insertion of new source "${seedSrc.name}" as its seed bias is unknown.`);
      }
    }

    // Now, process articles for this source if its ID is known and its bias is definitive (not unknown/null)
    if (sourceIdToProcess && currentSourceBiasInDB !== undefined && currentSourceBiasInDB !== null && currentSourceBiasInDB !== biasEnum.unknown) {
      const definitiveBiasForSource = currentSourceBiasInDB;
      
      // Find articles for this source that need their bias corrected or are not yet indexed correctly with the new bias.
      // An article needs update if:
      // 1. Its bias is unknown (0 or null).
      // 2. Its bias is different from the source's definitive bias.
      // We also re-index if the bias is already correct but indexed = 0 (e.g. from a previous failed attempt).
      const conditions: SQL[] = [
        eq(articles.sourceId, sourceIdToProcess),
        or(
          isNull(articles.bias),
          eq(articles.bias, biasEnum.unknown),
          ne(articles.bias, definitiveBiasForSource)
          // eq(articles.indexed, 0) // if we only want to update non-indexed or already marked ones
        )! // Non-null assertion for 'or' result
      ];

      const articlesToUpdate = await db.select({ id: articles.id, bias: articles.bias, indexed: articles.indexed })
        .from(articles)
        .where(and(...conditions));

      if (articlesToUpdate.length > 0) {
        console.log(`Found ${articlesToUpdate.length} articles for source "${seedSrc.name}" (ID: ${sourceIdToProcess}) that need bias correction to ${definitiveBiasForSource} and/or re-indexing.`);
        
        // Log details for a few articles before update for verification
        // articlesToUpdate.slice(0, 5).forEach(art => {
        //   console.log(`  - Article ID: ${art.id}, Current Bias: ${art.bias}, Indexed: ${art.indexed} -> Will be set to Bias: ${definitiveBiasForSource}, Indexed: 0`);
        // });

        await db.update(articles)
          .set({
            bias: definitiveBiasForSource,
            indexed: 0
          })
          .where(and(...conditions)); // Apply to the same set of articles
          
        console.log(`Updated ${articlesToUpdate.length} articles for source "${seedSrc.name}". They are now marked for re-indexing with bias ${definitiveBiasForSource}.`);
      } else {
        console.log(`No articles found for source "${seedSrc.name}" (ID: ${sourceIdToProcess}) that require bias correction or re-indexing based on its current bias ${definitiveBiasForSource}.`);
      }
    } else {
      if (!sourceIdToProcess) {
          console.log(`Skipping article processing for "${seedSrc.name}" as source ID could not be determined (e.g. new source insertion failed or skipped).`);
      } else {
          console.log(`Skipping article processing for source "${seedSrc.name}" (ID: ${sourceIdToProcess}) as its definitive bias is unknown or null (${currentSourceBiasInDB}).`);
      }
    }
    console.log(`--- Finished processing for source: "${seedSrc.name}" ---`);
  }
  console.log('Finished source seeding and article bias correction process.');
}

async function main() {
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Error during seeding process:", error);
    process.exitCode = 1; // Indicate failure
  } finally {
    console.log("Attempting to close database connection pool...");
    try {
      await poolConnection.end();
      console.log("Database connection pool closed successfully.");
    } catch (closeError) {
      console.error("Error closing database connection pool:", closeError);
      // If closing fails, it might mask the original error or be the primary error.
      // Ensure process exits with error code if it hasn't been set already.
      if (process.exitCode !== 1) {
        process.exitCode = 1;
      }
    }
  }
}

main(); 