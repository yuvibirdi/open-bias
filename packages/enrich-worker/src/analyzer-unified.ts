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

export async function analyzeArticleGroups() {
    const groupsToAnalyze = await db.query.articleGroups.findMany({
        where: eq(articleGroups.analysisCompleted, 0)
    });

    if (groupsToAnalyze.length === 0) {
        console.log("No new article groups to analyze.");
        return;
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
                    await tx.update(articles)
                        .set({
                            politicalLeaning: (analysis.leftBias - analysis.rightBias).toFixed(4), // Convert to -10 to +10 scale
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
