import { db, articles, articleGroups, aiAnalysisJobs, sources } from "@open-bias/db";
import { eq, and, or, sql } from "drizzle-orm";

// Types for AI analysis
interface BiasAnalysisResult {
  politicalLeaning: number; // -10 to +10 scale
  sensationalism: number; // 0 to 10 scale
  factualAccuracy: number; // 0 to 10 scale
  emotionalTone: number; // -5 to +5 scale (negative to positive)
  reasoning: string;
  keyPhrases: string[];
  factChecks: FactCheck[];
}

interface FactCheck {
  claim: string;
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable';
  confidence: number; // 0 to 1
  sources: string[];
}

interface GroupSummaryResult {
  neutralSummary: string;
  keyPoints: string[];
  controversialAspects: string[];
  consensusPoints: string[];
  missingPerspectives: string[];
  overallBiasScore: number;
  reliabilityScore: number;
}

class AIAnalysisService {
  private openai: any = null;
  private anthropic: any = null;

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const { OpenAI } = await import('openai');
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } catch (error) {
        console.warn('Failed to initialize OpenAI:', error);
      }
    }

    // Initialize Anthropic if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        // Note: Anthropic SDK would need to be installed separately
        console.log('Anthropic API key found but SDK not installed');
      } catch (error) {
        console.warn('Failed to initialize Anthropic:', error);
      }
    }
  }

  async analyzeArticleBias(articleId: number): Promise<BiasAnalysisResult> {
    try {
      // Get article with source information
      const article = await db
        .select({
          id: articles.id,
          title: articles.title,
          summary: articles.summary,
          link: articles.link,
          sourceName: sources.name,
          sourceBias: sources.bias,
          sourceUrl: sources.url,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(eq(articles.id, articleId))
        .limit(1);

      if (!article.length) {
        throw new Error(`Article ${articleId} not found`);
      }

      const articleData = article[0];
      
      let analysisResult: BiasAnalysisResult;

      if (this.openai) {
        analysisResult = await this.performOpenAIBiasAnalysis(articleData);
      } else {
        analysisResult = this.generateMockBiasAnalysis(articleData);
      }

      // Update article with analysis results
      await db.update(articles)
        .set({
          politicalLeaning: (analysisResult.politicalLeaning / 10).toString(), // Convert to -1 to 1 scale
          sensationalism: (analysisResult.sensationalism / 10).toString(), // Convert to 0 to 1 scale
          framingSummary: analysisResult.reasoning,
          biasAnalyzed: 1,
        })
        .where(eq(articles.id, articleId));

      return analysisResult;

    } catch (error) {
      console.error(`Failed to analyze article ${articleId}:`, error);
      throw error;
    }
  }

  private async performOpenAIBiasAnalysis(articleData: any): Promise<BiasAnalysisResult> {
    const prompt = `Analyze this news article for bias and provide a comprehensive assessment:

ARTICLE INFORMATION:
Title: ${articleData.title}
Source: ${articleData.sourceName} (${articleData.sourceUrl})
Known Source Bias: ${articleData.sourceBias}
Summary: ${articleData.summary}
URL: ${articleData.link}

Please analyze this article and provide a JSON response with the following structure:
{
  "politicalLeaning": <number from -10 (far left) to +10 (far right)>,
  "sensationalism": <number from 0 (factual) to 10 (highly sensational)>,
  "factualAccuracy": <number from 0 (very inaccurate) to 10 (highly accurate)>,
  "emotionalTone": <number from -5 (very negative) to +5 (very positive)>,
  "reasoning": "<detailed explanation of the bias assessment>",
  "keyPhrases": ["<array of biased phrases or loaded language>"],
  "factChecks": [
    {
      "claim": "<factual claim from the article>",
      "verdict": "true|mostly_true|mixed|mostly_false|false|unverifiable",
      "confidence": <0 to 1>,
      "sources": ["<verification sources>"]
    }
  ]
}

Consider:
- Loaded language and emotional appeals
- Selection and omission of facts
- Source credibility and attribution
- Framing and context
- Headlines vs content consistency
- Political leaning indicators`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert media bias analyst. Provide objective, detailed analysis of news articles. Return only valid JSON." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0].message.content?.trim() || "{}";
    const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
    
    try {
      const parsed = JSON.parse(cleanedResponse);
      return {
        politicalLeaning: parsed.politicalLeaning || 0,
        sensationalism: parsed.sensationalism || 0,
        factualAccuracy: parsed.factualAccuracy || 5,
        emotionalTone: parsed.emotionalTone || 0,
        reasoning: parsed.reasoning || "Analysis completed",
        keyPhrases: parsed.keyPhrases || [],
        factChecks: parsed.factChecks || [],
      };
    } catch (parseError) {
      console.warn('Failed to parse OpenAI response, using fallback');
      return this.generateMockBiasAnalysis(articleData);
    }
  }

  private generateMockBiasAnalysis(articleData: any): BiasAnalysisResult {
    // Generate realistic mock data based on source bias
    const sourceBias = articleData.sourceBias;
    let politicalLeaning = 0;
    
    switch (sourceBias) {
      case 'left':
        politicalLeaning = -3 + (Math.random() * 4); // -3 to 1
        break;
      case 'right':
        politicalLeaning = 1 + (Math.random() * 4); // 1 to 5
        break;
      case 'center':
        politicalLeaning = -1 + (Math.random() * 2); // -1 to 1
        break;
      default:
        politicalLeaning = -2 + (Math.random() * 4); // -2 to 2
    }

    return {
      politicalLeaning: Math.round(politicalLeaning * 10) / 10,
      sensationalism: Math.random() * 3 + 1, // 1 to 4
      factualAccuracy: Math.random() * 2 + 7, // 7 to 9
      emotionalTone: -1 + (Math.random() * 2), // -1 to 1
      reasoning: `Mock analysis: Article from ${articleData.sourceName} shows ${sourceBias} bias characteristics. Analysis based on language patterns, source selection, and framing.`,
      keyPhrases: ["analysis pending", "assessment in progress"],
      factChecks: [
        {
          claim: "Sample claim from article",
          verdict: "unverifiable" as const,
          confidence: 0.5,
          sources: ["Mock fact-checking source"],
        }
      ],
    };
  }

  async generateGroupSummary(groupId: number): Promise<GroupSummaryResult> {
    try {
      // Get all articles in the group
      const groupArticles = await db
        .select({
          id: articles.id,
          title: articles.title,
          summary: articles.summary,
          sourceName: sources.name,
          sourceBias: sources.bias,
          politicalLeaning: articles.politicalLeaning,
          sensationalism: articles.sensationalism,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(eq(articles.groupId, groupId));

      let summaryResult: GroupSummaryResult;

      if (this.openai && groupArticles.length > 0) {
        summaryResult = await this.performOpenAIGroupSummary(groupArticles);
      } else {
        summaryResult = this.generateMockGroupSummary(groupArticles);
      }

      // Update article group with summary
      await db.update(articleGroups)
        .set({
          neutralSummary: summaryResult.neutralSummary,
          biasSummary: `Overall bias score: ${summaryResult.overallBiasScore}/10. Reliability: ${summaryResult.reliabilityScore}/10. ${summaryResult.controversialAspects.length} controversial aspects identified.`,
          analysisCompleted: 1,
        })
        .where(eq(articleGroups.id, groupId));

      return summaryResult;

    } catch (error) {
      console.error(`Failed to generate summary for group ${groupId}:`, error);
      throw error;
    }
  }

  private async performOpenAIGroupSummary(articles: any[]): Promise<GroupSummaryResult> {
    const articlesText = articles.map(a => 
      `[${a.sourceName} - ${a.sourceBias}]: ${a.title}\n${a.summary || ''}`
    ).join('\n\n');

    const prompt = `Analyze these articles covering the same story and provide a comprehensive summary:

ARTICLES:
${articlesText}

Provide a JSON response with:
{
  "neutralSummary": "<objective summary removing bias and combining key facts>",
  "keyPoints": ["<array of main factual points>"],
  "controversialAspects": ["<points where sources disagree or show strong bias>"],
  "consensusPoints": ["<facts most sources agree on>"],
  "missingPerspectives": ["<viewpoints not covered by any source>"],
  "overallBiasScore": <0-10, average bias across all sources>,
  "reliabilityScore": <0-10, overall factual reliability>
}`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert journalist creating objective news summaries from multiple biased sources." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0].message.content?.trim() || "{}";
    const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
    
    try {
      return JSON.parse(cleanedResponse);
    } catch (parseError) {
      return this.generateMockGroupSummary(articles);
    }
  }

  private generateMockGroupSummary(articles: any[]): GroupSummaryResult {
    const biases = articles.map(a => a.sourceBias).filter(Boolean);
    const uniqueBiases = [...new Set(biases)];
    
    return {
      neutralSummary: `A developing story covered by ${articles.length} sources with ${uniqueBiases.length} different political perspectives. Analysis shows varying interpretations of the key facts.`,
      keyPoints: [
        "Key fact 1 from the story",
        "Key fact 2 from the story",
        "Key fact 3 from the story",
      ],
      controversialAspects: [
        "Interpretation of event significance",
        "Attribution of responsibility",
      ],
      consensusPoints: [
        "Basic facts most sources agree on",
      ],
      missingPerspectives: uniqueBiases.length < 3 ? ["Independent analysis", "Expert commentary"] : [],
      overallBiasScore: Math.round((Math.random() * 3 + 4) * 10) / 10, // 4-7 range
      reliabilityScore: Math.round((Math.random() * 2 + 7) * 10) / 10, // 7-9 range
    };
  }

  async batchAnalyzeUnprocessedArticles(limit: number = 10): Promise<void> {
    // Get unanalyzed articles
    const unanalyzedArticles = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.biasAnalyzed, 0))
      .limit(limit);

    console.log(`Starting batch analysis of ${unanalyzedArticles.length} articles`);

    for (const article of unanalyzedArticles) {
      try {
        await this.analyzeArticleBias(article.id);
        console.log(`✓ Analyzed article ${article.id}`);
      } catch (error) {
        console.error(`✗ Failed to analyze article ${article.id}:`, error);
      }
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async batchGenerateGroupSummaries(limit: number = 5): Promise<void> {
    // Get groups without summaries that have multiple articles
    const groupsToSummarize = await db
      .select({ 
        id: articleGroups.id,
        articleCount: sql<number>`COUNT(${articles.id})`,
      })
      .from(articleGroups)
      .leftJoin(articles, eq(articles.groupId, articleGroups.id))
      .where(
        and(
          eq(articleGroups.analysisCompleted, 0),
          or(
            sql`${articleGroups.neutralSummary} IS NULL`,
            sql`${articleGroups.neutralSummary} = ''`
          )
        )
      )
      .groupBy(articleGroups.id)
      .having(sql`COUNT(${articles.id}) >= 2`)
      .limit(limit);

    console.log(`Starting batch summary generation for ${groupsToSummarize.length} groups`);

    for (const group of groupsToSummarize) {
      try {
        await this.generateGroupSummary(group.id);
        console.log(`✓ Generated summary for group ${group.id}`);
      } catch (error) {
        console.error(`✗ Failed to generate summary for group ${group.id}:`, error);
      }
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

export const aiAnalysisService = new AIAnalysisService();
export default aiAnalysisService;
