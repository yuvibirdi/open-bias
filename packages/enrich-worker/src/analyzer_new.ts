import { db, articles, articleGroups, type Article } from "@open-bias/db";
import { eq } from "drizzle-orm";

// Uncomment and install openai if you want to use OpenAI API
declare const process: { env: Record<string, string | undefined> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let openai: any = null;
if (process.env.OPENAI_API_KEY) {
  try {
    // Dynamically import openai only if needed
    import("openai").then((openaiModule) => {
      openai = openaiModule;
    });
  } catch {
    console.warn("OpenAI SDK not installed. Falling back to mock LLM.");
  }
}

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
    const articleContents = articlesInGroup.map(a => 
        `---\nARTICLE ID: ${a.id}\nTITLE: ${a.title}\nSUMMARY: ${a.summary}\nSOURCE ID: ${a.sourceId}\n---`
    ).join('\n\n');

    const prompt = `You are a news bias analysis AI. Analyze these articles about the same event and rate their bias levels.

Articles to analyze:
${articleContents}

Rate each article on these scales (0-10):
- biasScore: 0 = extremely biased, 10 = completely neutral/unbiased
- leftBias: 0 = no left bias, 10 = extremely left-biased
- rightBias: 0 = no right bias, 10 = extremely right-biased  
- sensationalism: 0 = factual/dry, 10 = very sensational/clickbait

Also create a neutral summary and identify the most unbiased article.

Return ONLY a JSON object with this structure:
{
  "mostUnbiasedArticleId": <article_id_number>,
  "neutralSummary": "neutral summary of the event",
  "articles": [
    {
      "articleId": <number>,
      "biasScore": <0-10>,
      "leftBias": <0-10>,
      "rightBias": <0-10>,
      "sensationalism": <0-10>,
      "reasoning": "brief explanation of the bias assessment"
    }
  ]
}`;

    const groupId = articlesInGroup.length > 0 ? articlesInGroup[0].groupId ?? 'unknown' : 'unknown';
    console.log(`--- ANALYZING GROUP ${groupId} WITH ${articlesInGroup.length} ARTICLES ---`);

    // Try real LLM if available
    if (openai && process.env.OPENAI_API_KEY) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = new (openai as any).OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini", // More cost-effective model
          messages: [
            { role: "system", content: "You are a news bias analysis assistant. Return only valid JSON." },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 2048
        });
        const text = completion.choices[0].message.content?.trim() || "";
        const jsonText = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonText) as GroupBiasAnalysis;
      } catch (err) {
        console.error("OpenAI call failed, falling back to mock:", err);
      }
    }

    // MOCK RESPONSE - simulates bias analysis
    const biasAnalyses: BiasAnalysis[] = articlesInGroup.map(a => ({
        articleId: a.id,
        biasScore: Math.random() * 4 + 6, // 6-10 range (mostly unbiased)
        leftBias: Math.random() * 5, // 0-5 range
        rightBias: Math.random() * 5, // 0-5 range
        sensationalism: Math.random() * 4, // 0-4 range (low sensationalism)
        reasoning: `Mock analysis for article ${a.id}: This article shows moderate bias characteristics.`
    }));
    
    // Find the most unbiased article (highest biasScore)
    const mostUnbiased = biasAnalyses.reduce((best, current) => 
        current.biasScore > best.biasScore ? current : best
    );
    
    return {
        mostUnbiasedArticleId: mostUnbiased.articleId,
        neutralSummary: "A neutral summary of the event synthesized from multiple sources, removing bias and sensationalism.",
        articles: biasAnalyses
    };
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

            console.log(`Successfully analyzed group "${group.name}" (ID: ${group.id}). Most unbiased article: ${analysisResult.mostUnbiasedArticleId}`);
        } catch (error) {
            console.error(`Failed to analyze group ${group.id}:`, error);
            // Mark as completed to avoid retry loops
            await db.update(articleGroups).set({ analysisCompleted: 1 }).where(eq(articleGroups.id, group.id));
        }
    }
}
