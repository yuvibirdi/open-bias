/**
 * Unified AI Analysis System - OPTIMIZED
 * --------------------------
 * Supports both local LLMs (Ollama) and API-based LLMs (OpenAI, Gemini)
 * for news article bias analysis and semantic similarity detection.
 * 
 * 🚀 OPTIMIZATIONS:
 * - Cached provider detection (tests connection only once)
 * - Retry logic for AbortError with fresh connection test
 * - Eliminated redundant LLM connection calls per group
 * - Improved error handling and timeout management
 */

import { testLLMConnection, validateModels, LLM_CONFIG } from './llm-similarity';

declare const process: { env: Record<string, string | undefined> };

// Global connection state - cached after first successful test
let cachedProvider: AIProvider | null = null;
let connectionTested = false;

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

interface Article {
  id: number;
  title: string;
  summary: string | null;
  sourceId: number;
  groupId?: number | null;
}

/**
 * Available AI providers
 */
enum AIProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

/**
 * Detect available AI provider based on environment and connectivity
 * Caches result after first successful test to avoid redundant connection calls
 */
async function detectAIProvider(forceRetest: boolean = false): Promise<AIProvider> {
  // Return cached provider if available and not forcing retest
  if (cachedProvider && connectionTested && !forceRetest) {
    return cachedProvider;
  }

  console.log('🔍 Testing AI connectivity...');
  
  // Check for API keys first
  if (process.env.OPENAI_API_KEY) {
    console.log('🔑 OpenAI API key detected');
    cachedProvider = AIProvider.OPENAI;
    connectionTested = true;
    return AIProvider.OPENAI;
  }
  
  if (process.env.GEMINI_API_KEY) {
    console.log('🔑 Gemini API key detected');
    cachedProvider = AIProvider.GEMINI;
    connectionTested = true;
    return AIProvider.GEMINI;
  }
  
  // Check for local Ollama
  console.log('🏠 No API keys found, checking local Ollama...');
  const ollamaAvailable = await testLLMConnection();
  if (ollamaAvailable) {
    const modelsValid = await validateModels();
    if (modelsValid) {
      console.log('✅ Using local Ollama for AI analysis');
      cachedProvider = AIProvider.OLLAMA;
      connectionTested = true;
      return AIProvider.OLLAMA;
    }
  }
  
  throw new Error('❌ No AI provider available. Please set up Ollama locally or provide OpenAI/Gemini API keys.');
}

/**
 * Call Ollama API for analysis
 */
async function callOllamaForAnalysis(prompt: string): Promise<string> {
  const maxRetries = LLM_CONFIG.MAX_RETRIES;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      // Increase timeout for bias analysis (more complex than similarity checks)
      const timeoutId = setTimeout(() => controller.abort(), LLM_CONFIG.TIMEOUT_MS * 2);
      
      const response = await fetch(`${LLM_CONFIG.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: LLM_CONFIG.SIMILARITY_MODEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            num_predict: 1000,
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }
      
      const result = await response.json();
      return result.response?.trim() || '';
      
    } catch (error) {
      console.warn(`Ollama attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('All Ollama attempts failed');
}

/**
 * Call OpenAI API for analysis
 */
async function callOpenAIForAnalysis(prompt: string): Promise<string> {
  try {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a news bias analysis assistant. Return only valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 2048
    });
    
    return completion.choices[0].message.content?.trim() || '';
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    throw error;
  }
}

/**
 * Call Gemini API for analysis
 */
async function callGeminiForAnalysis(prompt: string): Promise<string> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a news bias analysis assistant. Return only valid JSON.\n\n${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

/**
 * Unified AI call that routes to the appropriate provider
 */
async function callAI(prompt: string, provider: AIProvider): Promise<string> {
  console.log(`🤖 Calling ${provider.toUpperCase()} for analysis...`);
  
  switch (provider) {
    case AIProvider.OLLAMA:
      return await callOllamaForAnalysis(prompt);
    case AIProvider.OPENAI:
      return await callOpenAIForAnalysis(prompt);
    case AIProvider.GEMINI:
      return await callGeminiForAnalysis(prompt);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Parse JSON response from AI with error handling
 */
function parseAIResponse(response: string): any {
  // Try to extract JSON from response - look for complete JSON objects
  let jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }
  
  let jsonString = jsonMatch[0];
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    // Try to clean up the JSON string
    console.log('First parse failed, trying to clean JSON...');
    
    // Remove any trailing text after the last }
    const lastBraceIndex = jsonString.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      jsonString = jsonString.substring(0, lastBraceIndex + 1);
    }
    
    try {
      return JSON.parse(jsonString);
    } catch (secondError) {
      console.error('Failed to parse AI JSON after cleanup:', jsonString);
      console.error('Original response:', response);
      throw new Error('Invalid JSON in AI response');
    }
  }
}

/**
 * Analyze bias of articles in a group using AI
 */
export async function analyzeBiasWithAI(articlesInGroup: Article[]): Promise<GroupBiasAnalysis> {
  const groupId = articlesInGroup.length > 0 ? articlesInGroup[0].groupId ?? 'unknown' : 'unknown';
  
  let provider: AIProvider;
  try {
    provider = await detectAIProvider(); // Use cached provider if available
  } catch (error) {
    throw new Error(`No AI provider available: ${error}`);
  }
  
  const articleContents = articlesInGroup.map(a => 
    `---\nARTICLE ID: ${a.id}\nTITLE: ${a.title}\nSUMMARY: ${a.summary || 'No summary available'}\nSOURCE ID: ${a.sourceId}\n---`
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

  console.log(`--- ANALYZING GROUP ${groupId} WITH ${articlesInGroup.length} ARTICLES USING ${provider.toUpperCase()} ---`);

  try {
    const response = await callAI(prompt, provider);
    const result = parseAIResponse(response);
    
    // Validate and sanitize the response
    const groupAnalysis: GroupBiasAnalysis = {
      mostUnbiasedArticleId: result.mostUnbiasedArticleId || (articlesInGroup[0]?.id ?? 0),
      neutralSummary: result.neutralSummary || "AI analysis completed but no neutral summary provided.",
      articles: (result.articles || []).map((article: any) => ({
        articleId: article.articleId,
        biasScore: Math.max(0, Math.min(10, article.biasScore || 5)),
        leftBias: Math.max(0, Math.min(10, article.leftBias || 0)),
        rightBias: Math.max(0, Math.min(10, article.rightBias || 0)),
        sensationalism: Math.max(0, Math.min(10, article.sensationalism || 0)),
        reasoning: article.reasoning || "No reasoning provided"
      }))
    };
    
    // Ensure all articles are analyzed
    const analyzedIds = new Set(groupAnalysis.articles.map(a => a.articleId));
    for (const article of articlesInGroup) {
      if (!analyzedIds.has(article.id)) {
        groupAnalysis.articles.push({
          articleId: article.id,
          biasScore: 5,
          leftBias: 0,
          rightBias: 0,
          sensationalism: 0,
          reasoning: "Article not analyzed by AI"
        });
      }
    }
    
    console.log(`✅ Successfully analyzed group ${groupId} with ${provider.toUpperCase()}`);
    return groupAnalysis;
    
  } catch (error) {
    console.error(`❌ AI analysis failed for group ${groupId}:`, error);
    
    // If it's an AbortError or network error, try retesting connection once
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log(`🔄 Retrying group ${groupId} with fresh connection test...`);
      try {
        provider = await detectAIProvider(true); // Force retest
        const response = await callAI(prompt, provider);
        const result = parseAIResponse(response);
        
        // Same validation as above
        const groupAnalysis: GroupBiasAnalysis = {
          mostUnbiasedArticleId: result.mostUnbiasedArticleId || (articlesInGroup[0]?.id ?? 0),
          neutralSummary: result.neutralSummary || "AI analysis completed but no neutral summary provided.",
          articles: (result.articles || []).map((article: any) => ({
            articleId: article.articleId,
            biasScore: Math.max(0, Math.min(10, article.biasScore || 5)),
            leftBias: Math.max(0, Math.min(10, article.leftBias || 0)),
            rightBias: Math.max(0, Math.min(10, article.rightBias || 0)),
            sensationalism: Math.max(0, Math.min(10, article.sensationalism || 0)),
            reasoning: article.reasoning || "No reasoning provided"
          }))
        };
        
        const analyzedIds = new Set(groupAnalysis.articles.map(a => a.articleId));
        for (const article of articlesInGroup) {
          if (!analyzedIds.has(article.id)) {
            groupAnalysis.articles.push({
              articleId: article.id,
              biasScore: 5,
              leftBias: 0,
              rightBias: 0,
              sensationalism: 0,
              reasoning: "Article not analyzed by AI"
            });
          }
        }
        
        console.log(`✅ Successfully analyzed group ${groupId} with ${provider.toUpperCase()} (retry)`);
        return groupAnalysis;
      } catch (retryError) {
        console.error(`❌ Retry also failed for group ${groupId}:`, retryError);
      }
    }
    
    throw new Error(`AI analysis failed: ${error}`);
  }
}

/**
 * Test AI connectivity
 */
export async function testAIConnectivity(): Promise<{ provider: AIProvider; available: boolean; error?: string }> {
  try {
    const provider = await detectAIProvider();
    
    // Test with a simple prompt
    const testPrompt = 'Respond with just "OK" if you can understand this message.';
    const response = await callAI(testPrompt, provider);
    
    const available = response.toLowerCase().includes('ok');
    return { provider, available };
  } catch (error) {
    return { 
      provider: AIProvider.OLLAMA, // Default fallback
      available: false, 
      error: String(error)
    };
  }
}

export { AIProvider };
