import { db, sources, type InsertSource } from './index';
import { eq } from 'drizzle-orm';

// Expanded list of news sources with proper bias classifications
const expandedSources: Omit<InsertSource, 'id' | 'fetchedAt'>[] = [
  // Existing sources (keep current ones)
  {
    name: 'Associated Press',
    url: 'https://apnews.com',
    rss: 'https://feeds.apnews.com/rss/apf-topnews',
    bias: 'center',
  },
  {
    name: 'Reuters',
    url: 'https://www.reuters.com',
    rss: 'https://feeds.reuters.com/reuters/topNews',
    bias: 'center',
  },
  {
    name: 'BBC News',
    url: 'https://www.bbc.com/news',
    rss: 'http://feeds.bbci.co.uk/news/rss.xml',
    bias: 'center',
  },
  {
    name: 'NPR',
    url: 'https://www.npr.org',
    rss: 'https://feeds.npr.org/1001/rss.xml',
    bias: 'left',
  },
  {
    name: 'Al Jazeera English',
    url: 'https://www.aljazeera.com',
    rss: 'https://www.aljazeera.com/xml/rss/all.xml',
    bias: 'center',
  },
  {
    name: 'CNN',
    url: 'https://www.cnn.com',
    rss: 'http://rss.cnn.com/rss/edition.rss',
    bias: 'left',
  },
  {
    name: 'Fox News',
    url: 'https://www.foxnews.com',
    rss: 'http://feeds.foxnews.com/foxnews/latest',
    bias: 'right',
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com',
    rss: 'https://www.theguardian.com/world/rss',
    bias: 'left',
  },
  {
    name: 'Daily Wire',
    url: 'https://www.dailywire.com',
    rss: 'https://www.dailywire.com/feeds/rss.xml',
    bias: 'right',
  },
  {
    name: 'Politico',
    url: 'https://www.politico.com',
    rss: 'https://www.politico.com/rss/politicopicks.xml',
    bias: 'center',
  },

  // NEW SOURCES - CENTER/NEUTRAL
  {
    name: 'Wall Street Journal',
    url: 'https://www.wsj.com',
    rss: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
    bias: 'center',
  },
  {
    name: 'USA Today',
    url: 'https://www.usatoday.com',
    rss: 'http://rssfeeds.usatoday.com/usatoday-NewsTopStories',
    bias: 'center',
  },
  {
    name: 'CBS News',
    url: 'https://www.cbsnews.com',
    rss: 'https://www.cbsnews.com/latest/rss/main',
    bias: 'center',
  },
  {
    name: 'ABC News',
    url: 'https://abcnews.go.com',
    rss: 'https://feeds.abcnews.com/abcnews/topstories',
    bias: 'center',
  },
  {
    name: 'NBC News',
    url: 'https://www.nbcnews.com',
    rss: 'http://feeds.nbcnews.com/nbcnews/public/news',
    bias: 'center',
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com',
    rss: 'https://www.ft.com/rss/home',
    bias: 'center',
  },
  {
    name: 'Bloomberg',
    url: 'https://www.bloomberg.com',
    rss: 'https://feeds.bloomberg.com/politics/news.rss',
    bias: 'center',
  },
  {
    name: 'Christian Science Monitor',
    url: 'https://www.csmonitor.com',
    rss: 'https://rss.csmonitor.com/feeds/all',
    bias: 'center',
  },

  // LEFT-LEANING SOURCES
  {
    name: 'New York Times',
    url: 'https://www.nytimes.com',
    rss: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    bias: 'left',
  },
  {
    name: 'Washington Post',
    url: 'https://www.washingtonpost.com',
    rss: 'http://feeds.washingtonpost.com/rss/politics',
    bias: 'left',
  },
  {
    name: 'The Atlantic',
    url: 'https://www.theatlantic.com',
    rss: 'https://feeds.feedburner.com/TheAtlantic',
    bias: 'left',
  },
  {
    name: 'The New Yorker',
    url: 'https://www.newyorker.com',
    rss: 'https://www.newyorker.com/feed/news',
    bias: 'left',
  },
  {
    name: 'Huffington Post',
    url: 'https://www.huffpost.com',
    rss: 'https://www.huffpost.com/section/front-page/feed',
    bias: 'left',
  },
  {
    name: 'MSNBC',
    url: 'https://www.msnbc.com',
    rss: 'http://www.msnbc.com/feeds/latest',
    bias: 'left',
  },
  {
    name: 'Vox',
    url: 'https://www.vox.com',
    rss: 'https://www.vox.com/rss/index.xml',
    bias: 'left',
  },
  {
    name: 'Mother Jones',
    url: 'https://www.motherjones.com',
    rss: 'https://www.motherjones.com/feed',
    bias: 'left',
  },
  {
    name: 'The Nation',
    url: 'https://www.thenation.com',
    rss: 'https://www.thenation.com/feed/',
    bias: 'left',
  },
  {
    name: 'Slate',
    url: 'https://slate.com',
    rss: 'https://slate.com/feeds/all.rss',
    bias: 'left',
  },

  // RIGHT-LEANING SOURCES
  {
    name: 'New York Post',
    url: 'https://nypost.com',
    rss: 'https://nypost.com/feed/',
    bias: 'right',
  },
  {
    name: 'Washington Examiner',
    url: 'https://www.washingtonexaminer.com',
    rss: 'https://www.washingtonexaminer.com/feed',
    bias: 'right',
  },
  {
    name: 'The Federalist',
    url: 'https://thefederalist.com',
    rss: 'https://thefederalist.com/feed/',
    bias: 'right',
  },
  {
    name: 'National Review',
    url: 'https://www.nationalreview.com',
    rss: 'https://www.nationalreview.com/feed/',
    bias: 'right',
  },
  {
    name: 'The American Conservative',
    url: 'https://www.theamericanconservative.com',
    rss: 'https://www.theamericanconservative.com/feed/',
    bias: 'right',
  },
  {
    name: 'Breitbart',
    url: 'https://www.breitbart.com',
    rss: 'https://feeds.feedburner.com/breitbart',
    bias: 'right',
  },
  {
    name: 'Washington Times',
    url: 'https://www.washingtontimes.com',
    rss: 'https://www.washingtontimes.com/rss/headlines/news/',
    bias: 'right',
  },
  {
    name: 'The Weekly Standard',
    url: 'https://www.weeklystandard.com',
    rss: 'https://www.weeklystandard.com/rss.xml',
    bias: 'right',
  },
  {
    name: 'Town Hall',
    url: 'https://townhall.com',
    rss: 'https://townhall.com/feeds/latest/',
    bias: 'right',
  },
  {
    name: 'The Blaze',
    url: 'https://www.theblaze.com',
    rss: 'https://www.theblaze.com/feeds/latest',
    bias: 'right',
  },

  // INTERNATIONAL SOURCES
  {
    name: 'The Times (UK)',
    url: 'https://www.thetimes.co.uk',
    rss: 'https://www.thetimes.co.uk/world/rss',
    bias: 'center',
  },
  {
    name: 'The Telegraph',
    url: 'https://www.telegraph.co.uk',
    rss: 'https://www.telegraph.co.uk/news/rss.xml',
    bias: 'right',
  },
  {
    name: 'The Independent',
    url: 'https://www.independent.co.uk',
    rss: 'http://www.independent.co.uk/news/world/rss',
    bias: 'left',
  },
  {
    name: 'Deutsche Welle',
    url: 'https://www.dw.com',
    rss: 'https://rss.dw.com/xml/rss-en-all',
    bias: 'center',
  },
  {
    name: 'France 24',
    url: 'https://www.france24.com',
    rss: 'https://www.france24.com/en/rss',
    bias: 'center',
  },
];

export async function seedExpandedSources() {
  console.log('🌱 Starting expanded source seeding...');
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const source of expandedSources) {
    try {
      // Check if source already exists by RSS URL
      const existing = await db.query.sources.findFirst({
        where: eq(sources.rss, source.rss),
      });

      if (existing) {
        console.log(`⚡ Source already exists: ${source.name}`);
        skippedCount++;
        continue;
      }

      // Insert new source
      await db.insert(sources).values(source);
      console.log(`✅ Added new source: ${source.name} [${source.bias}]`);
      insertedCount++;
      
    } catch (error) {
      console.error(`❌ Failed to add source ${source.name}:`, error);
    }
  }
  
  console.log(`\n📊 Seeding Summary:`);
  console.log(`   ✅ Inserted: ${insertedCount} sources`);
  console.log(`   ⚡ Skipped: ${skippedCount} sources`);
  console.log(`   📰 Total: ${expandedSources.length} sources processed`);
  
  // Get final count
  const totalSources = await db.select().from(sources);
  console.log(`   🗄️  Database now contains ${totalSources.length} total sources`);
}

// Run if called directly
if (require.main === module) {
  seedExpandedSources()
    .then(() => {
      console.log('✨ Expanded source seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error during expanded source seeding:', error);
      process.exit(1);
    });
}

export { expandedSources };
