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

interface ArticleAnalysis {
    articleId: number;
    politicalLeaning: number; // -1.0 (left) to 1.0 (right)
    sensationalism: number; // 0.0 (factual) to 1.0 (sensationalist)
    framingSummary: string;
    biasScore: number;
    leftBias: number;
    rightBias: number;
    reasoning: string;
}

interface GroupAnalysis {
    neutralSummary: string;
    biasSummary: string;
    articleAnalyses: ArticleAnalysis[];
    mostUnbiasedArticleId: number;
}

async function callLLMForAnalysis(articlesInGroup: Article[]): Promise<GroupAnalysis> {
    const articleContents = articlesInGroup.map(a => 
        `---\nARTICLE ID: ${a.id}\nTITLE: ${a.title}\nSUMMARY: ${a.summary}\nSOURCE: ${a.sourceId}\n---`
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
  "articleAnalyses": [
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupId = articlesInGroup.length > 0 ? (articlesInGroup[0] as any).groupId ?? 'unknown' : 'unknown';
    console.log(`--- ANALYZING GROUP ${groupId} WITH ${articlesInGroup.length} ARTICLES ---`);

    // Try real LLM if available
    if (openai) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completion = await (openai as any).createChatCompletion({
          model: "gpt-4o", // or gpt-3.5-turbo, etc.
          messages: [
            { role: "system", content: "You are a news bias analysis assistant. Return only valid JSON." },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 2048
        });
        const text = completion.data.choices[0].message.content.trim();
        const jsonText = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonText) as GroupAnalysis;
      } catch (err) {
        console.error("OpenAI call failed, falling back to mock:", err);
      }
    }

    // MOCK RESPONSE - simulates bias analysis
    const mockResponse: GroupAnalysis = {
        mostUnbiasedArticleId: articlesInGroup.length > 0 ? articlesInGroup[0].id : 0,
        neutralSummary: "A neutral summary of the event synthesized from multiple sources, removing bias and sensationalism.",
        biasSummary: "Mock bias analysis completed. Articles show varying degrees of political leaning and sensationalism.",
        articleAnalyses: articlesInGroup.map(a => ({
            articleId: a.id,
            politicalLeaning: (Math.random() - 0.5) * 2, // -1.0 to 1.0 range
            sensationalism: Math.random() * 0.4, // 0.0-0.4 range (low sensationalism)
            framingSummary: `Mock analysis for article ${a.id}: This article shows moderate bias characteristics.`,
            biasScore: Math.random() * 4 + 6, // 6-10 range (mostly unbiased)
            leftBias: Math.random() * 5, // 0-5 range
            rightBias: Math.random() * 5, // 0-5 range
            reasoning: `Mock reasoning for article ${a.id}: Overall assessment of bias patterns.`
        }))
    };
    
    // Find the most unbiased article (highest biasScore)
    if (mockResponse.articleAnalyses.length > 0) {
        const mostUnbiased = mockResponse.articleAnalyses.reduce((best, current) => 
            current.biasScore > best.biasScore ? current : best
        );
        mockResponse.mostUnbiasedArticleId = mostUnbiased.articleId;
    }
    
    return Promise.resolve(mockResponse);
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
            const analysisResult = await callLLMForAnalysis(articlesInGroup);

            await db.transaction(async (tx) => {
                for (const articleAnalysis of analysisResult.articleAnalyses) {
                    await tx.update(articles)
                        .set({
                            politicalLeaning: (articleAnalysis.leftBias - articleAnalysis.rightBias).toFixed(4), // Convert to -10 to +10 scale
                            sensationalism: (articleAnalysis.sensationalism / 10).toFixed(4), // Convert to 0-1 scale  
                            framingSummary: articleAnalysis.reasoning,
                            biasAnalyzed: 1
                        })
                        .where(eq(articles.id, articleAnalysis.articleId));
                }

                await tx.update(articleGroups).set({
                    neutralSummary: analysisResult.neutralSummary,
                    biasSummary: `Most unbiased article ID: ${analysisResult.mostUnbiasedArticleId}`,
                    analysisCompleted: 1
                }).where(eq(articleGroups.id, group.id));
            });

            console.log(`Successfully analyzed and updated group "${group.name}" (ID: ${group.id}).`);
        } catch (error) {
            console.error(`Failed to analyze group ${group.id}:`, error);
        }
    }
}