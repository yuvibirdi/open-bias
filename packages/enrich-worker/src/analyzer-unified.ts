import { db, articles, articleGroups, type Article } from "@open-bias/db";
import { eq } from "drizzle-orm";
import { analyzeBiasWithAI } from "./ai-analysis";

interface BiasAnalysis {
    articleId: number;
    biasScore: number; // 0.0 (most biased) to 10.0 (most neutral/unbiased)
    leftBias: number; // 0.0 to 10.0 (how left-leaning)
    rightBias: number; // 0.0 to 10.0 (how right-leaning)
    sensationalism: number; // 0.0 (factual) to 10.0 (very sensationalist)
    reasoning: string;
}

interface GroupBiasAnalysis {
    mostUnbiasedArticleId: number;
    neutralSummary: string;
    articles: BiasAnalysis[];
}

async function analyzeBiasWithLLM(articlesInGroup: Article[]): Promise<GroupBiasAnalysis> {
    const groupId = articlesInGroup.length > 0 ? articlesInGroup[0].groupId ?? 'unknown' : 'unknown';
    console.log(`--- ANALYZING GROUP ${groupId} WITH ${articlesInGroup.length} ARTICLES ---`);

    try {
        // Use the unified AI analysis system
        const result = await analyzeBiasWithAI(articlesInGroup as any[]);
        
        // Convert to expected format
        return {
            mostUnbiasedArticleId: result.mostUnbiasedArticleId,
            neutralSummary: result.neutralSummary,
            articles: result.articles
        };
    } catch (error) {
        console.error(`❌ AI analysis failed for group ${groupId}:`, error);
        throw new Error(`AI analysis failed: ${error}`);
    }
}

/**
 * Analyze a single group immediately after it's formed
 * This function is called from grouper-optimized.ts for real-time bias analysis
 * ✅ INTEGRATED: Now used for efficient pipeline processing
 */
export async function analyzeGroupImmediately(groupId: number): Promise<boolean> {
    try {
        const articlesInGroup = await db.query.articles.findMany({
            where: eq(articles.groupId, groupId)
        }) as Article[];

        if (articlesInGroup.length === 0) {
            await db.update(articleGroups).set({ analysisCompleted: 1 }).where(eq(articleGroups.id, groupId));
            return true;
        }

        const analysisResult = await analyzeBiasWithLLM(articlesInGroup);

        await db.transaction(async (tx) => {
            // Update individual articles with bias scores
            for (const analysis of analysisResult.articles) {
                // Normalize political leaning to -1.0 to +1.0 range
                // leftBias=10, rightBias=0 should become +1.0 (left)
                // leftBias=0, rightBias=10 should become -1.0 (right)
                // leftBias=5, rightBias=5 should become 0.0 (neutral)
                const normalizedLeaning = ((analysis.leftBias - analysis.rightBias) / 10).toFixed(4);
                
                await tx.update(articles)
                    .set({
                        politicalLeaning: normalizedLeaning, // Now properly normalized to -1 to +1
                        sensationalism: (analysis.sensationalism / 10).toFixed(4), // Convert to 0-1 scale  
                        framingSummary: analysis.reasoning,
                        biasAnalyzed: 1
                    })
                    .where(eq(articles.id, analysis.articleId));
            }

            // Update group with neutral summary and most unbiased article
            await tx.update(articleGroups).set({
                neutralSummary: analysisResult.neutralSummary,
                biasSummary: `Bias analysis completed. Most unbiased article: ${analysisResult.mostUnbiasedArticleId}`,
                analysisCompleted: 1
            }).where(eq(articleGroups.id, groupId));
        });

        console.log(`✅ Immediately analyzed group ${groupId}. Most unbiased article: ${analysisResult.mostUnbiasedArticleId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to immediately analyze group ${groupId}:`, error);
        // Mark as completed to avoid retry loops
        await db.update(articleGroups).set({ 
            analysisCompleted: 1,
            biasSummary: `Analysis failed: ${error}`
        }).where(eq(articleGroups.id, groupId));
        return false;
    }
}

export async function analyzeArticleGroups(groupLimit: number = -1) {
    let groupsToAnalyze = await db.query.articleGroups.findMany({
        where: eq(articleGroups.analysisCompleted, 0)
    });

    if (groupsToAnalyze.length === 0) {
        console.log("No new article groups to analyze.");
        return;
    }

    // Apply limit for development
    if (groupLimit !== -1 && groupsToAnalyze.length > groupLimit) {
        console.log(`🎯 Development limit: analyzing only ${groupLimit} of ${groupsToAnalyze.length} groups`);
        groupsToAnalyze = groupsToAnalyze.slice(0, groupLimit);
    }

    console.log(`Found ${groupsToAnalyze.length} groups to analyze.`);

    for (const group of groupsToAnalyze) {
        const articlesInGroup = await db.query.articles.findMany({
            where: eq(articles.groupId, group.id)
        }) as Article[];

        if (articlesInGroup.length === 0) {
            await db.update(articleGroups).set({ analysisCompleted: 1 }).where(eq(articleGroups.id, group.id));
            continue;
        }

        try {
            const analysisResult = await analyzeBiasWithLLM(articlesInGroup);

            await db.transaction(async (tx) => {
                // Update individual articles with bias scores
                for (const analysis of analysisResult.articles) {
                    // Normalize political leaning to -1.0 to +1.0 range
                    const normalizedLeaning = ((analysis.leftBias - analysis.rightBias) / 10).toFixed(4);
                    
                    await tx.update(articles)
                        .set({
                            politicalLeaning: normalizedLeaning, // Now properly normalized to -1 to +1
                            sensationalism: (analysis.sensationalism / 10).toFixed(4), // Convert to 0-1 scale  
                            framingSummary: analysis.reasoning,
                            biasAnalyzed: 1
                        })
                        .where(eq(articles.id, analysis.articleId));
                }

                // Update group with neutral summary and most unbiased article
                await tx.update(articleGroups).set({
                    neutralSummary: analysisResult.neutralSummary,
                    biasSummary: `Bias analysis completed. Most unbiased article: ${analysisResult.mostUnbiasedArticleId}`,
                    analysisCompleted: 1
                }).where(eq(articleGroups.id, group.id));
            });

            console.log(`✅ Successfully analyzed group "${group.name}" (ID: ${group.id}). Most unbiased article: ${analysisResult.mostUnbiasedArticleId}`);
            
            // Add small delay between analyses to prevent overwhelming Ollama
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ Failed to analyze group ${group.id}:`, error);
            // Mark as completed to avoid retry loops
            await db.update(articleGroups).set({ 
                analysisCompleted: 1,
                biasSummary: `Analysis failed: ${error}`
            }).where(eq(articleGroups.id, group.id));
        }
    }
}
