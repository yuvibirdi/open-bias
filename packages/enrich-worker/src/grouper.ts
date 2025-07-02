
import { db, articles, articleGroups, type Article } from "@open-bias/db";
import { isNull, inArray } from "drizzle-orm";
import { analyzeArticleSimilarity, testLLMConnection, validateModels, getEmbeddings, cosineSimilarity, type ArticleContent } from "./llm-similarity";

const EMBEDDING_THRESHOLD = 0.65; // Fast embedding pre-filter
const LLM_THRESHOLD = 0.75; // Final LLM verification
const BATCH_SIZE = 50; // Process articles in batches for memory efficiency

/**
 * Helper for graph traversal (DFS) to find connected components.
 * @param nodeId The starting article ID.
 * @param adj The adjacency list representing the similarity graph.
 * @param visited A set of visited article IDs.
 * @param component The array to store the current group/component.
 */
function dfs(
    nodeId: number,
    adj: Map<number, number[]>,
    visited: Set<number>,
    component: number[]
) {
    visited.add(nodeId);
    component.push(nodeId);
    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            dfs(neighbor, adj, visited, component);
        }
    }
}

export async function groupArticles() {
    // 1. Get all articles that are not yet grouped.
    const ungroupedArticles = await db
        .select()
        .from(articles)
        .where(isNull(articles.groupId));

    if (ungroupedArticles.length < 2) {
        console.log("Not enough articles to form groups.");
        return;
    }

    console.log(`Found ${ungroupedArticles.length} ungrouped articles to process.`);

    const articlesWithSummary = ungroupedArticles.filter(a => a.summary && a.summary.length > 50);
    if (articlesWithSummary.length < 2) {
        console.log("Not enough articles with summaries to form groups.");
        return;
    }

    // Check if LLM is available
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

    console.log("🧠 Using optimized LLM-powered similarity analysis for grouping...");
    
    // 2. Group articles by source to avoid comparing articles from the same source
    const articlesBySource = new Map<number, typeof articlesWithSummary>();
    for (const article of articlesWithSummary) {
        if (!articlesBySource.has(article.sourceId)) {
            articlesBySource.set(article.sourceId, []);
        }
        articlesBySource.get(article.sourceId)!.push(article);
    }

    console.log(`📊 Articles spread across ${articlesBySource.size} sources`);

    // 3. Pre-compute embeddings for all articles in batches
    console.log("🔄 Pre-computing embeddings for all articles...");
    const articleEmbeddings = new Map<number, number[]>();
    
    for (let i = 0; i < articlesWithSummary.length; i += BATCH_SIZE) {
        const batch = articlesWithSummary.slice(i, i + BATCH_SIZE);
        console.log(`   Processing embedding batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(articlesWithSummary.length/BATCH_SIZE)}`);
        
        const embeddings = await Promise.all(
            batch.map(async article => {
                const text = `${article.title} ${article.summary}`;
                return getEmbeddings(text);
            })
        );
        
        batch.forEach((article, idx) => {
            if (embeddings[idx].length > 0) {
                articleEmbeddings.set(article.id, embeddings[idx]);
            }
        });
    }
    
    console.log(`✅ Computed embeddings for ${articleEmbeddings.size}/${articlesWithSummary.length} articles`);

    // 4. Find candidate pairs using fast embedding similarity (only cross-source)
    console.log("🔍 Finding candidate pairs using embedding similarity...");
    const candidatePairs: Array<{ article1: typeof articlesWithSummary[0], article2: typeof articlesWithSummary[0], embeddingSim: number }> = [];
    
    const sourceIds = Array.from(articlesBySource.keys());
    let totalComparisons = 0;
    let candidatesFound = 0;
    
    for (let i = 0; i < sourceIds.length; i++) {
        const source1Articles = articlesBySource.get(sourceIds[i])!;
        
        for (let j = i + 1; j < sourceIds.length; j++) {
            const source2Articles = articlesBySource.get(sourceIds[j])!;
            
            // Compare all articles between these two sources
            for (const article1 of source1Articles) {
                const embed1 = articleEmbeddings.get(article1.id);
                if (!embed1) continue;
                
                for (const article2 of source2Articles) {
                    const embed2 = articleEmbeddings.get(article2.id);
                    if (!embed2) continue;
                    
                    totalComparisons++;
                    const embeddingSim = cosineSimilarity(embed1, embed2);
                    
                    if (embeddingSim > EMBEDDING_THRESHOLD) {
                        candidatePairs.push({ article1, article2, embeddingSim });
                        candidatesFound++;
                    }
                }
            }
        }
    }
    
    console.log(`� Embedding analysis: ${candidatesFound} candidates from ${totalComparisons} comparisons (${((candidatesFound/totalComparisons)*100).toFixed(1)}% pass rate)`);
    
    if (candidatePairs.length === 0) {
        console.log("No candidate pairs found using embedding similarity.");
        return;
    }

    // 5. Sort candidates by embedding similarity (highest first)
    candidatePairs.sort((a, b) => b.embeddingSim - a.embeddingSim);
    
    // 6. Use LLM to verify top candidates in parallel batches
    console.log(`🤖 Verifying top ${candidatePairs.length} candidates with LLM...`);
    const adj = new Map<number, number[]>();
    for (const article of articlesWithSummary) {
        adj.set(article.id, []);
    }
    
    const LLM_BATCH_SIZE = 10; // Process LLM comparisons in smaller batches
    let verifiedMatches = 0;
    
    for (let i = 0; i < candidatePairs.length; i += LLM_BATCH_SIZE) {
        const batch = candidatePairs.slice(i, i + LLM_BATCH_SIZE);
        console.log(`   LLM batch ${Math.floor(i/LLM_BATCH_SIZE) + 1}/${Math.ceil(candidatePairs.length/LLM_BATCH_SIZE)} (${batch.length} pairs)`);
        
        const llmResults = await Promise.all(
            batch.map(async ({ article1, article2, embeddingSim }) => {
                try {
                    const articleContent1: ArticleContent = {
                        title: article1.title,
                        summary: article1.summary!,
                        url: article1.link
                    };

                    const articleContent2: ArticleContent = {
                        title: article2.title,
                        summary: article2.summary!,
                        url: article2.link
                    };

                    const result = await analyzeArticleSimilarity(articleContent1, articleContent2);
                    return { article1, article2, result, embeddingSim };
                } catch (error) {
                    console.error(`❌ LLM verification failed for articles ${article1.id}-${article2.id}:`, error);
                    return null;
                }
            })
        );
        
        // Process results
        for (const llmResult of llmResults) {
            if (llmResult && llmResult.result.isMatch) {
                adj.get(llmResult.article1.id)!.push(llmResult.article2.id);
                adj.get(llmResult.article2.id)!.push(llmResult.article1.id);
                verifiedMatches++;
                
                console.log(`✅ MATCH: "${llmResult.article1.title.substring(0, 40)}..." <-> "${llmResult.article2.title.substring(0, 40)}..."`);
                console.log(`   Embedding: ${llmResult.embeddingSim.toFixed(3)}, Final: ${llmResult.result.similarity.toFixed(3)}`);
            }
        }
    }
    
    console.log(`📊 LLM verification: ${verifiedMatches} verified matches from ${candidatePairs.length} candidates`);

    // 7. Find connected components (these are the groups)
    const visited = new Set<number>();
    const groups: number[][] = [];
    for (const article of articlesWithSummary) {
        if (!visited.has(article.id)) {
            const component: number[] = [];
            dfs(article.id, adj, visited, component);
            if (component.length > 1) {
                groups.push(component);
            }
        }
    }

    if (groups.length === 0) {
        console.log("No new article groups found using optimized LLM analysis.");
        return;
    }

    console.log(`📊 Found ${groups.length} new article groups using optimized LLM similarity analysis.`);

    // 8. Create group records in DB and update articles
    for (const articleIdsInGroup of groups) {
        const articlesInGroup = articleIdsInGroup.map(id => articlesWithSummary.find(a => a.id === id)!);
        const masterArticle = articlesInGroup.reduce((prev, current) => ((prev.summary?.length ?? 0) > (current.summary?.length ?? 0)) ? prev : current);

        const [newGroup] = await db.insert(articleGroups).values({
            name: masterArticle.title,
            masterArticleId: masterArticle.id,
        });

        await db
            .update(articles)
            .set({ groupId: newGroup.insertId })
            .where(inArray(articles.id, articleIdsInGroup));
        
        console.log(`✅ Created group "${masterArticle.title}" with ${articleIdsInGroup.length} articles from ${new Set(articlesInGroup.map(a => a.sourceId)).size} sources.`);
        
        // Show the articles in this group
        const sourceBreakdown = articlesInGroup.reduce((acc, article) => {
            acc[article.sourceId] = (acc[article.sourceId] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);
        
        console.log(`   Source breakdown: ${Object.entries(sourceBreakdown).map(([sourceId, count]) => `Source ${sourceId}: ${count}`).join(', ')}`);
    }
}
