/**
 * Semantic Preprocessing and Keyword Analysis
 * ------------------------------------------
 * Performs fast semantic preprocessing using keyword extraction,
 * topic modeling, and loose matching to narrow down article candidates
 * before expensive LLM/embedding operations.
 */

import { type Article } from "@open-bias/db";

// Common news topics and their related keywords
const TOPIC_KEYWORDS = {
  politics: [
    'election', 'vote', 'candidate', 'congress', 'senate', 'house', 'president', 'governor',
    'mayor', 'democrat', 'republican', 'campaign', 'policy', 'legislation', 'bill', 'law',
    'government', 'administration', 'political', 'politician', 'debate', 'polling'
  ],
  economy: [
    'economy', 'economic', 'finance', 'financial', 'market', 'stock', 'trading', 'investment',
    'gdp', 'inflation', 'recession', 'unemployment', 'jobs', 'employment', 'fed', 'federal reserve',
    'interest rate', 'monetary', 'fiscal', 'budget', 'deficit', 'debt', 'banking', 'bank'
  ],
  technology: [
    'technology', 'tech', 'ai', 'artificial intelligence', 'machine learning', 'software',
    'hardware', 'computer', 'internet', 'digital', 'cyber', 'data', 'privacy', 'security',
    'blockchain', 'cryptocurrency', 'bitcoin', 'startup', 'innovation', 'app', 'platform'
  ],
  health: [
    'health', 'medical', 'medicine', 'hospital', 'doctor', 'patient', 'disease', 'virus',
    'covid', 'pandemic', 'vaccine', 'treatment', 'drug', 'pharmaceutical', 'healthcare',
    'wellness', 'mental health', 'public health', 'epidemic', 'clinical', 'research'
  ],
  international: [
    'international', 'foreign', 'global', 'world', 'country', 'nation', 'diplomatic',
    'embassy', 'ambassador', 'treaty', 'alliance', 'war', 'conflict', 'peace', 'refugee',
    'immigration', 'border', 'trade', 'export', 'import', 'sanctions', 'nato', 'un'
  ],
  climate: [
    'climate', 'environment', 'environmental', 'global warming', 'carbon', 'emissions',
    'renewable', 'solar', 'wind', 'fossil fuel', 'oil', 'gas', 'coal', 'pollution',
    'sustainability', 'green', 'conservation', 'wildlife', 'ecosystem', 'temperature'
  ],
  crime: [
    'crime', 'criminal', 'police', 'arrest', 'court', 'trial', 'judge', 'jury', 'lawsuit',
    'investigation', 'evidence', 'witness', 'suspect', 'victim', 'murder', 'theft', 'fraud',
    'prison', 'jail', 'sentence', 'prosecution', 'defense', 'justice', 'law enforcement'
  ],
  sports: [
    'sports', 'game', 'team', 'player', 'coach', 'season', 'championship', 'league',
    'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'olympics',
    'tournament', 'match', 'score', 'win', 'loss', 'athletic', 'stadium'
  ]
};

// High-impact event keywords that often generate news across sources
const EVENT_KEYWORDS = [
  'breaking', 'urgent', 'developing', 'live', 'update', 'latest', 'just in',
  'explosion', 'shooting', 'attack', 'accident', 'crash', 'fire', 'storm',
  'earthquake', 'flood', 'hurricane', 'emergency', 'evacuation', 'rescue',
  'protest', 'demonstration', 'rally', 'march', 'strike', 'riot',
  'announcement', 'reveals', 'announces', 'confirms', 'denies', 'reports'
];

// Named entities that often appear in related articles
const ENTITY_PATTERNS = [
  // People (titles + names)
  /(?:president|senator|governor|mayor|ceo|director)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/gi,
  // Organizations
  /(?:FBI|CIA|NASA|WHO|UN|NATO|EU|NATO|OPEC|G7|G20)/gi,
  // Companies (common ones)
  /(?:Apple|Google|Microsoft|Amazon|Facebook|Meta|Twitter|Tesla|Netflix|Uber)/gi,
  // Countries and major cities
  /(?:United States|America|China|Russia|Germany|France|Japan|India|Brazil|Canada|Mexico|Iran|Israel|Ukraine|Syria|Afghanistan|Iraq|London|Paris|Tokyo|Beijing|Moscow|Berlin|Rome|Madrid)/gi,
  // Currencies and financial terms
  /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|trillion))?/gi,
  // Dates and times
  /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi
];

interface ArticleKeywords {
  id: number;
  title: string;
  summary: string;
  keywords: string[];
  topics: string[];
  entities: string[];
  keywordScore: number;
}

interface SemanticMatch {
  article1Id: number;
  article2Id: number;
  matchScore: number;
  matchedKeywords: string[];
  matchedTopics: string[];
  matchedEntities: string[];
  reasoning: string;
}

/**
 * Extract keywords and topics from article text
 */
function extractKeywords(text: string): { keywords: string[], topics: string[], entities: string[] } {
  const normalizedText = text.toLowerCase();
  const keywords: string[] = [];
  const topics: string[] = [];
  const entities: string[] = [];

  // Extract topic-based keywords
  for (const [topic, topicKeywords] of Object.entries(TOPIC_KEYWORDS)) {
    const matches = topicKeywords.filter(keyword => 
      normalizedText.includes(keyword.toLowerCase())
    );
    if (matches.length > 0) {
      topics.push(topic);
      keywords.push(...matches);
    }
  }

  // Extract event keywords
  const eventMatches = EVENT_KEYWORDS.filter(keyword => 
    normalizedText.includes(keyword.toLowerCase())
  );
  keywords.push(...eventMatches);

  // Extract named entities using patterns
  for (const pattern of ENTITY_PATTERNS) {
    const matches = text.match(pattern) || [];
    entities.push(...matches.map(match => match.trim()));
  }

  // Extract quoted phrases (often important)
  const quotedPhrases = text.match(/"([^"]+)"/g) || [];
  keywords.push(...quotedPhrases.map(quote => quote.replace(/"/g, '')));

  // Extract capitalized phrases (potential proper nouns)
  const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
  entities.push(...capitalizedPhrases);

  return {
    keywords: [...new Set(keywords)], // Remove duplicates
    topics: [...new Set(topics)],
    entities: [...new Set(entities)]
  };
}

/**
 * Calculate keyword overlap score between two articles
 */
function calculateKeywordScore(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));
  
  const intersection = new Set([...set1].filter(k => set2.has(k)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Calculate topic overlap score
 */
function calculateTopicScore(topics1: string[], topics2: string[]): number {
  if (topics1.length === 0 || topics2.length === 0) return 0;

  const commonTopics = topics1.filter(topic => topics2.includes(topic));
  const totalTopics = new Set([...topics1, ...topics2]).size;
  
  return commonTopics.length / totalTopics;
}

/**
 * Calculate entity overlap score (weighted higher for exact matches)
 */
function calculateEntityScore(entities1: string[], entities2: string[]): number {
  if (entities1.length === 0 || entities2.length === 0) return 0;

  const set1 = new Set(entities1.map(e => e.toLowerCase()));
  const set2 = new Set(entities2.map(e => e.toLowerCase()));
  
  const exactMatches = [...set1].filter(e => set2.has(e));
  const partialMatches = [...set1].filter(e1 => 
    [...set2].some(e2 => e1.includes(e2) || e2.includes(e1))
  );
  
  const exactScore = exactMatches.length / Math.max(set1.size, set2.size);
  const partialScore = partialMatches.length / Math.max(set1.size, set2.size) * 0.5;
  
  return exactScore + partialScore;
}

/**
 * Preprocess articles to extract semantic information
 */
export function preprocessArticles(articles: Article[]): ArticleKeywords[] {
  console.log(`🔍 Preprocessing ${articles.length} articles for semantic analysis...`);
  
  const processed = articles.map(article => {
    const text = `${article.title} ${article.summary || ''}`;
    const { keywords, topics, entities } = extractKeywords(text);
    
    // Calculate a composite keyword score based on relevance
    const keywordScore = (
      keywords.length * 0.3 +
      topics.length * 0.4 +
      entities.length * 0.3
    ) / Math.max(text.length / 100, 1); // Normalize by text length
    
    return {
      id: article.id,
      title: article.title,
      summary: article.summary || '',
      keywords,
      topics,
      entities,
      keywordScore
    };
  });
  
  console.log(`✅ Preprocessing complete. Average keywords per article: ${
    (processed.reduce((sum, p) => sum + p.keywords.length, 0) / processed.length).toFixed(1)
  }`);
  
  return processed;
}

/**
 * Find semantic matches using keyword and topic analysis
 */
export function findSemanticMatches(
  processedArticles: ArticleKeywords[],
  threshold: number = 0.3
): SemanticMatch[] {
  console.log(`🎯 Finding semantic matches with threshold ${threshold}...`);
  
  const matches: SemanticMatch[] = [];
  let comparisons = 0;
  
  for (let i = 0; i < processedArticles.length; i++) {
    const article1 = processedArticles[i];
    
    for (let j = i + 1; j < processedArticles.length; j++) {
      const article2 = processedArticles[j];
      comparisons++;
      
      // Calculate component scores
      const keywordScore = calculateKeywordScore(article1.keywords, article2.keywords);
      const topicScore = calculateTopicScore(article1.topics, article2.topics);
      const entityScore = calculateEntityScore(article1.entities, article2.entities);
      
      // Weighted composite score
      const matchScore = (
        keywordScore * 0.3 +
        topicScore * 0.4 +
        entityScore * 0.3
      );
      
      if (matchScore >= threshold) {
        const matchedKeywords = article1.keywords.filter(k1 =>
          article2.keywords.some(k2 => k1.toLowerCase() === k2.toLowerCase())
        );
        
        const matchedTopics = article1.topics.filter(t => article2.topics.includes(t));
        
        const matchedEntities = article1.entities.filter(e1 =>
          article2.entities.some(e2 => e1.toLowerCase() === e2.toLowerCase())
        );
        
        const reasoning = [
          matchedTopics.length > 0 ? `Topics: ${matchedTopics.join(', ')}` : '',
          matchedKeywords.length > 0 ? `Keywords: ${matchedKeywords.slice(0, 3).join(', ')}` : '',
          matchedEntities.length > 0 ? `Entities: ${matchedEntities.slice(0, 2).join(', ')}` : ''
        ].filter(Boolean).join(' | ');
        
        matches.push({
          article1Id: article1.id,
          article2Id: article2.id,
          matchScore,
          matchedKeywords,
          matchedTopics,
          matchedEntities,
          reasoning
        });
      }
      
      if (comparisons % 5000 === 0) {
        console.log(`   📊 Processed ${comparisons} comparisons...`);
      }
    }
  }
  
  // Sort by match score (highest first)
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  console.log(`📋 Found ${matches.length} semantic matches from ${comparisons} comparisons`);
  console.log(`   Average match score: ${(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length).toFixed(3)}`);
  
  return matches;
}

/**
 * Filter semantic matches to create candidate pairs for embedding/LLM verification
 */
export function createCandidatePairs(
  semanticMatches: SemanticMatch[],
  maxCandidatesPerArticle: number = 5
): Map<number, number[]> {
  console.log(`🎛️ Creating candidate pairs (max ${maxCandidatesPerArticle} per article)...`);
  
  const candidates = new Map<number, number[]>();
  const articleCounts = new Map<number, number>();
  
  // Initialize maps
  for (const match of semanticMatches) {
    if (!candidates.has(match.article1Id)) candidates.set(match.article1Id, []);
    if (!candidates.has(match.article2Id)) candidates.set(match.article2Id, []);
    articleCounts.set(match.article1Id, 0);
    articleCounts.set(match.article2Id, 0);
  }
  
  // Add candidates up to the limit
  for (const match of semanticMatches) {
    const count1 = articleCounts.get(match.article1Id) || 0;
    const count2 = articleCounts.get(match.article2Id) || 0;
    
    if (count1 < maxCandidatesPerArticle && count2 < maxCandidatesPerArticle) {
      candidates.get(match.article1Id)!.push(match.article2Id);
      candidates.get(match.article2Id)!.push(match.article1Id);
      
      articleCounts.set(match.article1Id, count1 + 1);
      articleCounts.set(match.article2Id, count2 + 1);
    }
  }
  
  const totalCandidates = Array.from(candidates.values()).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`✅ Created ${totalCandidates} candidate pairs for verification`);
  
  return candidates;
}

export type { ArticleKeywords, SemanticMatch };
