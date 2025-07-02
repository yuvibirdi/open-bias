import { db, articles, articleGroups, sources, type Article } from "@open-bias/db";
import { isNull, inArray, eq, ne, isNotNull, and } from "drizzle-orm";
import { getEmbeddings, cosineSimilarity, analyzeArticleSimilarity, testLLMConnection, validateModels, type ArticleContent } from "./llm-similarity";
import { preprocessArticles, findSemanticMatches, createCandidatePairs, type ArticleKeywords, type SemanticMatch } from "./semantic-preprocessing";
import { analyzeGroupImmediately } from "./analyzer-unified";

// Configuration constants
const EMBEDDING_SIMILARITY_THRESHOLD = 0.55; // Lower threshold for initial filtering
const LLM_SIMILARITY_THRESHOLD = 0.75; // Higher threshold for final grouping
const SEMANTIC_SIMILARITY_THRESHOLD = 0.3; // Threshold for semantic keyword matching
const DEFAULT_BATCH_SIZE = 100; // Default batch size for production
const DEFAULT_MAX_ARTICLES_PER_SOURCE = 50; // Default max articles per source
const MAGIC_NUMBER_DEFAULT = -1; // -1 means process all available articles

interface GrouperConfig {
  maxTotalArticles?: number; // Magic number: total articles to process (-1 for all)
  maxArticlesPerSource?: number; // Max articles per source
  semanticThreshold?: number; // Semantic keyword similarity threshold
  embeddingThreshold?: number; // Embedding similarity threshold
  llmThreshold?: number; // LLM similarity threshold
  testMode?: boolean; // Enable test mode with smaller batches
  verbose?: boolean; // Enable verbose logging
  aiAvailable?: boolean; // Whether AI analysis is available for immediate processing
}

interface ArticleWithEmbedding extends Article {
  embedding?: number[];
  text: string;
}

/**
 * Get a balanced subset of articles from different sources
 */
async function getBalancedArticleSubset(
  maxTotal: number = DEFAULT_BATCH_SIZE,
  maxPerSource: number = DEFAULT_MAX_ARTICLES_PER_SOURCE
): Promise<Article[]> {
  console.log(`🎯 Getting balanced subset of ${maxTotal === -1 ? 'ALL' : maxTotal} articles...`);
  
  // Get all sources
  const allSources = await db.select().from(sources);
  console.log(`📰 Found ${allSources.length} sources`);
  
  let articlesPerSource: number;
  if (maxTotal === -1) {
    // Process all articles, but still limit per source
    articlesPerSource = maxPerSource;
    console.log(`🔢 Processing ALL articles (max ${articlesPerSource} per source)`);
  } else {
    articlesPerSource = Math.ceil(maxTotal / allSources.length);
    console.log(`🔢 Target: ${articlesPerSource} articles per source`);
  }
  
  const selectedArticles: Article[] = [];
  
  for (const source of allSources) {
    const sourceArticles = await db
      .select()
      .from(articles)
      .where(
        and(
          isNull(articles.groupId),
          eq(articles.sourceId, source.id),
          isNotNull(articles.summary),
          ne(articles.summary, '')
        )
      )
      .limit(Math.min(articlesPerSource, maxPerSource));
    
    selectedArticles.push(...sourceArticles as Article[]);
    console.log(`📄 Source "${source.name}": ${sourceArticles.length} articles`);
    
    // Only break early if we have a specific target
    if (maxTotal !== -1 && selectedArticles.length >= maxTotal) break;
  }
  
  const finalSelection = maxTotal === -1 ? selectedArticles : selectedArticles.slice(0, maxTotal);
  console.log(`✅ Selected ${finalSelection.length} articles for processing\n`);
  
  return finalSelection;
}

/**
 * Pre-compute embeddings for all articles
 */
async function precomputeEmbeddings(articleList: Article[]): Promise<ArticleWithEmbedding[]> {
  console.log(`🧮 Pre-computing embeddings for ${articleList.length} articles...`);
  
  const articlesWithEmbeddings: ArticleWithEmbedding[] = [];
  let processed = 0;
  
  for (const article of articleList) {
    const text = `${article.title} ${article.summary || ''}`;
    
    try {
      const embedding = await getEmbeddings(text);
      articlesWithEmbeddings.push({
        ...article,
        embedding,
        text
      });
      processed++;
      
      if (processed % 20 === 0) {
        console.log(`   📊 Processed ${processed}/${articleList.length} embeddings`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to get embedding for article ${article.id}: ${error}`);
      articlesWithEmbeddings.push({
        ...article,
        embedding: [],
        text
      });
    }
  }
  
  console.log(`✅ Completed embedding computation\n`);
  return articlesWithEmbeddings;
}

/**
 * Fast embedding-based similarity screening
 */
function findEmbeddingSimilarCandidates(
  articlesWithEmbeddings: ArticleWithEmbedding[],
  threshold: number = EMBEDDING_SIMILARITY_THRESHOLD
): Map<number, number[]> {
  console.log(`🔍 Finding embedding-similar candidates (threshold: ${threshold})...`);
  
  const candidates = new Map<number, number[]>();
  
  // Initialize candidate lists
  for (const article of articlesWithEmbeddings) {
    candidates.set(article.id, []);
  }
  
  let comparisons = 0;
  const totalComparisons = (articlesWithEmbeddings.length * (articlesWithEmbeddings.length - 1)) / 2;
  
  for (let i = 0; i < articlesWithEmbeddings.length; i++) {
    const article1 = articlesWithEmbeddings[i];
    
    for (let j = i + 1; j < articlesWithEmbeddings.length; j++) {
      const article2 = articlesWithEmbeddings[j];
      comparisons++;
      
      // Skip articles from the same source
      if (article1.sourceId === article2.sourceId) continue;
      
      // Skip if either doesn't have embeddings
      if (!article1.embedding?.length || !article2.embedding?.length) continue;
      
      const similarity = cosineSimilarity(article1.embedding, article2.embedding);
      
      if (similarity > threshold) {
        candidates.get(article1.id)!.push(article2.id);
        candidates.get(article2.id)!.push(article1.id);
      }
      
      if (comparisons % 1000 === 0) {
        console.log(`   🔄 Processed ${comparisons}/${totalComparisons} comparisons`);
      }
    }
  }
  
  const candidatePairs = Array.from(candidates.entries())
    .filter(([_, ids]) => ids.length > 0);
  
  console.log(`📋 Found ${candidatePairs.length} articles with embedding-similar candidates\n`);
  return candidates;
}

/**
 * Verify similarity with LLM and create groups immediately
 */
async function verifyAndGroupWithLLM(
  articlesWithEmbeddings: ArticleWithEmbedding[],
  candidates: Map<number, number[]>,
  threshold: number = LLM_SIMILARITY_THRESHOLD,
  verbose: boolean = false,
  aiAvailable: boolean = false
): Promise<void> {
  console.log(`🤖 Verifying candidates with LLM (threshold: ${threshold}) and creating groups...`);
  
  const articleMap = new Map(articlesWithEmbeddings.map(a => [a.id, a]));
  const processed = new Set<string>(); // Track processed pairs
  const grouped = new Set<number>(); // Track articles already in groups
  
  let groupsCreated = 0;
  let llmVerifications = 0;
  
  for (const [articleId, candidateIds] of candidates.entries()) {
    if (grouped.has(articleId)) continue; // Already grouped
    
    const article = articleMap.get(articleId);
    if (!article) continue;
    
    const groupMembers = [articleId];
    
    for (const candidateId of candidateIds) {
      if (grouped.has(candidateId)) continue; // Already grouped
      
      const pairKey = [articleId, candidateId].sort().join('-');
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);
      
      const candidate = articleMap.get(candidateId);
      if (!candidate) continue;
      
      // Verify with LLM
      try {
        llmVerifications++;
        if (verbose) {
          console.log(`   🔍 LLM verification ${llmVerifications}: "${article.title.substring(0, 40)}..." vs "${candidate.title.substring(0, 40)}..."`);
        }
        
        const articleContent1: ArticleContent = {
          title: article.title,
          summary: article.summary || '',
          url: article.link
        };
        
        const articleContent2: ArticleContent = {
          title: candidate.title,
          summary: candidate.summary || '',
          url: candidate.link
        };
        
        const similarityResult = await analyzeArticleSimilarity(articleContent1, articleContent2);
        
        if (similarityResult.similarity >= threshold) {
          if (verbose) {
            console.log(`   ✅ LLM confirmed match (${similarityResult.similarity.toFixed(3)})`);
          }
          groupMembers.push(candidateId);
        } else {
          if (verbose) {
            console.log(`   ❌ LLM rejected (${similarityResult.similarity.toFixed(3)})`);
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ LLM verification failed: ${error}`);
      }
    }
    
    // Create group if we have multiple members
    if (groupMembers.length > 1) {
      try {
        const masterArticle = articlesWithEmbeddings.find(a => a.id === articleId)!;
        
        const [newGroup] = await db.insert(articleGroups).values({
          name: masterArticle.title,
          masterArticleId: masterArticle.id,
        });
        
        await db
          .update(articles)
          .set({ groupId: newGroup.insertId })
          .where(inArray(articles.id, groupMembers));
        
        // Mark as grouped
        groupMembers.forEach(id => grouped.add(id));
        groupsCreated++;
        
        console.log(`   🎉 Created group "${masterArticle.title.substring(0, 50)}..." with ${groupMembers.length} articles`);
        if (verbose) {
          console.log(`      Articles: ${groupMembers.join(', ')}\n`);
        }

        // 🚀 IMMEDIATE BIAS ANALYSIS - Analyze the group right after creation!
        if (aiAvailable) {
          console.log(`   🧠 Analyzing bias for group ${newGroup.insertId} immediately...`);
          const analysisSuccess = await analyzeGroupImmediately(newGroup.insertId);
          if (analysisSuccess) {
            console.log(`   ✅ Group ${newGroup.insertId} analyzed successfully`);
          } else {
            console.log(`   ⚠️ Group ${newGroup.insertId} analysis failed, but continuing...`);
          }
        } else {
          console.log(`   ⏩ Skipping immediate analysis for group ${newGroup.insertId} (AI not available)`);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to create group: ${error}`);
      }
    }
  }
  
  console.log(`📊 LLM verification complete:`);
  console.log(`   Groups created: ${groupsCreated}`);
  console.log(`   LLM verifications: ${llmVerifications}`);
  console.log(`   Articles grouped: ${grouped.size}\n`);
}

/**
 * Verify semantic candidates using embedding similarity
 */
function verifyWithEmbeddings(
  articlesWithEmbeddings: ArticleWithEmbedding[],
  semanticCandidates: Map<number, number[]>,
  threshold: number = EMBEDDING_SIMILARITY_THRESHOLD,
  verbose: boolean = false
): Map<number, number[]> {
  console.log(`🔍 Verifying semantic candidates with embeddings (threshold: ${threshold})...`);
  
  const embeddingCandidates = new Map<number, number[]>();
  const articleMap = new Map(articlesWithEmbeddings.map(a => [a.id, a]));
  
  let verifications = 0;
  let passed = 0;
  
  for (const [articleId, candidateIds] of semanticCandidates.entries()) {
    const article = articleMap.get(articleId);
    if (!article || !article.embedding?.length) continue;
    
    const verifiedCandidates: number[] = [];
    
    for (const candidateId of candidateIds) {
      const candidate = articleMap.get(candidateId);
      if (!candidate || !candidate.embedding?.length) continue;
      
      verifications++;
      const similarity = cosineSimilarity(article.embedding, candidate.embedding);
      
      if (similarity > threshold) {
        verifiedCandidates.push(candidateId);
        passed++;
        
        if (verbose) {
          console.log(`   ✅ Embedding match: "${article.title.substring(0, 30)}..." vs "${candidate.title.substring(0, 30)}..." (${similarity.toFixed(3)})`);
        }
      } else if (verbose) {
        console.log(`   ❌ Embedding reject: "${article.title.substring(0, 30)}..." vs "${candidate.title.substring(0, 30)}..." (${similarity.toFixed(3)})`);
      }
    }
    
    if (verifiedCandidates.length > 0) {
      embeddingCandidates.set(articleId, verifiedCandidates);
    }
  }
  
  console.log(`📊 Embedding verification: ${passed}/${verifications} candidates passed (${(passed/verifications*100).toFixed(1)}%)`);
  
  return embeddingCandidates;
}

/**
 * Optimized article grouping with multi-stage filtering
 */
export async function groupArticles(config: GrouperConfig = {}): Promise<void> {
  const {
    maxTotalArticles = MAGIC_NUMBER_DEFAULT,
    maxArticlesPerSource = DEFAULT_MAX_ARTICLES_PER_SOURCE,
    semanticThreshold = SEMANTIC_SIMILARITY_THRESHOLD,
    embeddingThreshold = EMBEDDING_SIMILARITY_THRESHOLD,
    llmThreshold = LLM_SIMILARITY_THRESHOLD,
    testMode = false,
    verbose = false,
    aiAvailable = false
  } = config;

  console.log("🚀 Starting Multi-Stage Article Grouping...\n");
  
  if (verbose) {
    console.log("📋 Configuration:");
    console.log(`   Max total articles: ${maxTotalArticles === -1 ? 'ALL' : maxTotalArticles}`);
    console.log(`   Max per source: ${maxArticlesPerSource}`);
    console.log(`   Semantic threshold: ${semanticThreshold}`);
    console.log(`   Embedding threshold: ${embeddingThreshold}`);
    console.log(`   LLM threshold: ${llmThreshold}`);
    console.log(`   Test mode: ${testMode}\n`);
  }
  
  // Test LLM availability
  const llmAvailable = await testLLMConnection();
  if (!llmAvailable) {
    console.error("❌ LLM not available for grouping. Skipping grouping process.");
    return;
  }
  
  const modelsValid = await validateModels();
  if (!modelsValid) {
    console.error("❌ Required LLM models not available. Skipping grouping process.");
    return;
  }
  
  // Stage 1: Get balanced subset of articles
  const targetArticles = testMode ? 50 : (maxTotalArticles === -1 ? -1 : maxTotalArticles);
  const ungroupedArticles = await getBalancedArticleSubset(targetArticles, maxArticlesPerSource);
  
  if (ungroupedArticles.length < 2) {
    console.log("✅ Not enough articles to form groups.");
    return;
  }
  
  // Stage 2: Semantic preprocessing and keyword matching
  console.log("🔍 Stage 2: Semantic Preprocessing...");
  const processedArticles = preprocessArticles(ungroupedArticles);
  const semanticMatches = findSemanticMatches(processedArticles, semanticThreshold);
  const semanticCandidates = createCandidatePairs(semanticMatches, 10); // Max 10 candidates per article
  
  if (semanticCandidates.size === 0) {
    console.log("✅ No semantic matches found. No groups to create.");
    return;
  }
  
  // Stage 3: Pre-compute embeddings for articles with semantic matches
  console.log("🧮 Stage 3: Computing Embeddings for Semantic Candidates...");
  const candidateArticleIds = new Set<number>();
  for (const [articleId, candidates] of semanticCandidates.entries()) {
    candidateArticleIds.add(articleId);
    candidates.forEach(id => candidateArticleIds.add(id));
  }
  
  const articlesForEmbedding = ungroupedArticles.filter(article => 
    candidateArticleIds.has(article.id)
  );
  
  console.log(`   🎯 Computing embeddings for ${articlesForEmbedding.length} articles (filtered from ${ungroupedArticles.length})`);
  const articlesWithEmbeddings = await precomputeEmbeddings(articlesForEmbedding);
  
  // Stage 4: Embedding similarity verification on semantic candidates
  console.log("📊 Stage 4: Embedding Similarity Verification...");
  const embeddingCandidates = verifyWithEmbeddings(articlesWithEmbeddings, semanticCandidates, embeddingThreshold, verbose);
  
  if (embeddingCandidates.size === 0) {
    console.log("✅ No embedding matches found. No groups to create.");
    return;
  }
  
  // Stage 5: LLM verification and group creation
  console.log("🤖 Stage 5: LLM Verification and Group Creation...");
  await verifyAndGroupWithLLM(articlesWithEmbeddings, embeddingCandidates, llmThreshold, verbose, aiAvailable);
  
  console.log("✅ Multi-stage grouping process completed!");
}
