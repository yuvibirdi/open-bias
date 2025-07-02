/**
 * LLM-Powered Semantic Similarity Analysis
 * ----------------------------------------
 * Uses local Ollama models to perform accurate semantic similarity detection
 * for news article grouping, replacing the broken TF-IDF approach.
 */

interface SimilarityResult {
  similarity: number;
  reasoning: string;
  isMatch: boolean;
}

interface ArticleContent {
  title: string;
  summary: string;
  url?: string;
}

const LLM_CONFIG = {
  SIMILARITY_MODEL: 'llama3.2:3b',  // For semantic analysis
  EMBED_MODEL: 'nomic-embed-text',   // For embeddings
  SIMILARITY_THRESHOLD: 0.75,        // Stricter threshold for grouping
  OLLAMA_BASE_URL: 'http://localhost:11434',
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
};

/**
 * Call Ollama API for text generation
 */
async function callOllama(model: string, prompt: string, options: any = {}): Promise<string> {
  const maxRetries = LLM_CONFIG.MAX_RETRIES;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LLM_CONFIG.TIMEOUT_MS);
      
      const response = await fetch(`${LLM_CONFIG.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,  // Low temperature for consistent analysis
            top_p: 0.9,
            num_predict: 500,
            ...options
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
        throw new Error(`Ollama failed after ${maxRetries} attempts: ${error}`);
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('All Ollama attempts failed');
}

/**
 * Get embeddings for text using Nomic Embed
 */
async function getEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${LLM_CONFIG.OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_CONFIG.EMBED_MODEL,
        prompt: text
      })
    });
    
    if (!response.ok) {
      throw new Error(`Embeddings API error: ${response.status}`);
    }
    
    const result = await response.json();
    return result.embedding || [];
  } catch (error) {
    console.warn('Embeddings failed, falling back to text analysis:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1.length || !vec2.length || vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Analyze semantic similarity between two articles using LLM
 */
async function analyzeSimilarityWithLLM(article1: ArticleContent, article2: ArticleContent): Promise<SimilarityResult> {
  const prompt = `Analyze if these two news articles are about the same story or event. Respond with JSON only.

Article 1:
Title: "${article1.title}"
Summary: "${article1.summary}"

Article 2:
Title: "${article2.title}"
Summary: "${article2.summary}"

Determine:
1. Are they about the same news story/event?
2. Similarity score (0.0 to 1.0)
3. Brief reasoning

Respond with JSON in this exact format:
{
  "similarity": 0.85,
  "isMatch": true,
  "reasoning": "Both articles discuss the same legislative bill passage"
}`;

  try {
    const response = await callOllama(LLM_CONFIG.SIMILARITY_MODEL, prompt);
    
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in LLM response:', response);
      return {
        similarity: 0,
        reasoning: 'Failed to parse LLM response',
        isMatch: false
      };
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      similarity: Math.max(0, Math.min(1, result.similarity || 0)),
      reasoning: result.reasoning || 'No reasoning provided',
      isMatch: result.similarity >= LLM_CONFIG.SIMILARITY_THRESHOLD
    };
    
  } catch (error) {
    console.error('LLM similarity analysis failed:', error);
    return {
      similarity: 0,
      reasoning: `Analysis failed: ${error}`,
      isMatch: false
    };
  }
}

/**
 * Hybrid similarity analysis combining embeddings and LLM
 */
async function analyzeArticleSimilarity(article1: ArticleContent, article2: ArticleContent): Promise<SimilarityResult> {
  console.log(`🧠 Analyzing similarity between:`);
  console.log(`   1: "${article1.title.substring(0, 60)}..."`);
  console.log(`   2: "${article2.title.substring(0, 60)}..."`);
  
  try {
    // First try embeddings for quick similarity check
    const text1 = `${article1.title} ${article1.summary}`;
    const text2 = `${article2.title} ${article2.summary}`;
    
    const [embed1, embed2] = await Promise.all([
      getEmbeddings(text1),
      getEmbeddings(text2)
    ]);
    
    let embeddingSimilarity = 0;
    if (embed1.length && embed2.length) {
      embeddingSimilarity = cosineSimilarity(embed1, embed2);
      console.log(`   📊 Embedding similarity: ${embeddingSimilarity.toFixed(3)}`);
    }
    
    // If embeddings suggest high similarity, use LLM for detailed analysis
    if (embeddingSimilarity > 0.6 || embed1.length === 0) {
      console.log(`   🤖 Running LLM analysis...`);
      const llmResult = await analyzeSimilarityWithLLM(article1, article2);
      
      // Combine embedding and LLM scores
      const finalSimilarity = embed1.length > 0 
        ? (embeddingSimilarity * 0.3 + llmResult.similarity * 0.7)
        : llmResult.similarity;
      
      const result = {
        similarity: finalSimilarity,
        reasoning: `Embedding: ${embeddingSimilarity.toFixed(3)}, LLM: ${llmResult.similarity.toFixed(3)} - ${llmResult.reasoning}`,
        isMatch: finalSimilarity >= LLM_CONFIG.SIMILARITY_THRESHOLD
      };
      
      console.log(`   ✅ Final similarity: ${result.similarity.toFixed(3)} (${result.isMatch ? 'MATCH' : 'NO MATCH'})`);
      console.log(`   💭 Reasoning: ${result.reasoning}`);
      
      return result;
    } else {
      console.log(`   ⚡ Low embedding similarity, skipping LLM analysis`);
      return {
        similarity: embeddingSimilarity,
        reasoning: `Low embedding similarity: ${embeddingSimilarity.toFixed(3)}`,
        isMatch: false
      };
    }
    
  } catch (error) {
    console.error('❌ Similarity analysis failed:', error);
    return {
      similarity: 0,
      reasoning: `Analysis failed: ${error}`,
      isMatch: false
    };
  }
}

/**
 * Test LLM connectivity and models
 */
async function testLLMConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing LLM connection...');
    
    const testResponse = await callOllama(LLM_CONFIG.SIMILARITY_MODEL, 'Respond with just "OK" if you can understand this message.');
    
    if (testResponse.toLowerCase().includes('ok')) {
      console.log('✅ LLM connection successful');
      return true;
    } else {
      console.warn('⚠️ LLM responded but unexpectedly:', testResponse);
      return false;
    }
  } catch (error) {
    console.error('❌ LLM connection failed:', error);
    return false;
  }
}

/**
 * Validate that required models are available
 */
async function validateModels(): Promise<boolean> {
  try {
    const response = await fetch(`${LLM_CONFIG.OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    const modelNames = data.models?.map((m: any) => m.name) || [];
    
    const hasLLM = modelNames.some((name: string) => name.includes(LLM_CONFIG.SIMILARITY_MODEL));
    const hasEmbed = modelNames.some((name: string) => name.includes(LLM_CONFIG.EMBED_MODEL));
    
    console.log(`📋 Available models: ${modelNames.join(', ')}`);
    console.log(`✅ LLM model (${LLM_CONFIG.SIMILARITY_MODEL}): ${hasLLM ? 'Available' : 'Missing'}`);
    console.log(`✅ Embed model (${LLM_CONFIG.EMBED_MODEL}): ${hasEmbed ? 'Available' : 'Missing'}`);
    
    return hasLLM; // Embed model is optional
  } catch (error) {
    console.error('❌ Model validation failed:', error);
    return false;
  }
}

export {
  analyzeArticleSimilarity,
  testLLMConnection,
  validateModels,
  getEmbeddings,
  cosineSimilarity,
  LLM_CONFIG,
  type SimilarityResult,
  type ArticleContent
};
