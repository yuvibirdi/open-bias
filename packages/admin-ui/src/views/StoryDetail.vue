<template>
  <div class="story-detail-page">
    <div v-if="loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      <p class="mt-4 text-gray-600">Loading story details...</p>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <div class="text-red-500 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">Story Not Found</h3>
      <p class="text-gray-600 mb-4">{{ error }}</p>
      <button 
        @click="$router.push('/stories')"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Back to Stories
      </button>
    </div>

    <div v-else-if="story" class="max-w-4xl mx-auto">
      <!-- Back button -->
      <button 
        @click="$router.back()"
        class="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Back
      </button>

      <!-- Story header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-4">
            <span class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
              {{ story.category }}
            </span>
            <span class="text-sm text-gray-500">
              {{ formatDate(story.publishedAt) }}
            </span>
          </div>
          
          <div class="flex items-center space-x-2">
            <button 
              @click="shareStory"
              class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Share story"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
              </svg>
            </button>
            <button 
              @click="toggleBookmark"
              class="p-2 transition-colors"
              :class="isBookmarked ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'"
              title="Bookmark story"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
              </svg>
            </button>
          </div>
        </div>

        <h1 class="text-3xl font-bold text-gray-900 mb-4">{{ story.title }}</h1>
        
        <!-- Hero Image from first source with image -->
        <div v-if="getHeroImage()" class="mb-6 rounded-xl overflow-hidden">
          <img 
            :src="getHeroImage()"
            :alt="story.title"
            class="w-full h-64 md:h-80 object-cover"
            loading="eager"
            @error="handleImageError"
          />
        </div>
        
        <p class="text-xl text-gray-600 leading-relaxed mb-6">{{ story.summary }}</p>

        <!-- Bias analysis -->
        <div v-if="story.biasAnalysis" class="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">AI Bias Analysis</h3>
          <div class="flex items-center mb-3">
            <span class="text-sm text-gray-600 mr-3">Overall Bias Score:</span>
            <div class="flex items-center space-x-2">
              <div class="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-300"
                  :class="getBiasColor(story.biasAnalysis.overallScore)"
                  :style="{ width: `${Math.abs(story.biasAnalysis.overallScore) * 10}%` }"
                ></div>
              </div>
              <span class="text-sm font-medium">
                {{ story.biasAnalysis.overallScore.toFixed(1) }}
              </span>
            </div>
          </div>
          <p class="text-gray-700">{{ story.biasAnalysis.explanation }}</p>
        </div>
      </div>

      <!-- Coverage map -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Coverage Across Sources</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            v-for="source in story.sources" 
            :key="source.id"
            class="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            <!-- Article Image -->
            <div class="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
              <img 
                v-if="source.imageUrl" 
                :src="source.imageUrl"
                :alt="source.title"
                class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                @error="handleImageError"
                loading="lazy"
              />
              <div 
                v-else 
                class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
              >
                <div class="text-center">
                  <svg class="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
                  </svg>
                  <p class="text-xs text-gray-500 font-medium">{{ source.name }}</p>
                </div>
              </div>
              
              <!-- Source bias indicator overlay -->
              <div class="absolute top-3 right-3">
                <div 
                  class="px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                  :class="getBiasChipClasses(source.biasScore || 0)"
                >
                  {{ getBiasLabel(source.biasScore || 0) }}
                </div>
              </div>
            </div>

            <!-- Article Content -->
            <div class="p-5">
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight">
                  {{ source.title }}
                </h4>
              </div>
              
              <p class="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                {{ source.excerpt || source.summary }}
              </p>
              
              <!-- Source info and actions -->
              <div class="flex items-center justify-between border-t border-gray-100 pt-3">
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span class="text-xs font-bold text-white">{{ source.name.charAt(0) }}</span>
                  </div>
                  <div>
                    <p class="text-xs font-medium text-gray-900">{{ source.name }}</p>
                    <p class="text-xs text-gray-500">{{ formatDate(source.publishedAt) }}</p>
                  </div>
                </div>
                
                <a 
                  :href="source.url" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                >
                  Read
                  <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Comments and ratings -->
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-900">Community Rating</h3>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">Rate this story's bias:</span>
            <div class="flex items-center space-x-1">
              <button
                v-for="rating in [1, 2, 3, 4, 5]"
                :key="rating"
                @click="rateStory(rating)"
                class="p-1 text-gray-300 hover:text-yellow-400 transition-colors"
                :class="{ 'text-yellow-400': userRating >= rating }"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900">{{ story.stats?.averageRating || 0 }}</div>
            <div class="text-sm text-gray-600">Average Rating</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900">{{ story.stats?.totalRatings || 0 }}</div>
            <div class="text-sm text-gray-600">Total Ratings</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-900">{{ story.sources?.length || 0 }}</div>
            <div class="text-sm text-gray-600">Sources</div>
          </div>
        </div>

        <!-- Add comment section placeholder -->
        <div class="border-t border-gray-200 pt-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Discussion</h4>
          <div class="text-center py-8 text-gray-500">
            <p>Community discussion feature coming soon!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

interface Source {
  id: string
  name: string
  url: string
  excerpt: string
  publishedAt: string
  biasScore?: number
}

interface BiasAnalysis {
  overallScore: number
  explanation: string
  confidence: number
}

interface Story {
  id: string
  title: string
  summary: string
  category: string
  publishedAt: string
  sources: Source[]
  biasAnalysis?: BiasAnalysis
  stats?: {
    averageRating: number
    totalRatings: number
  }
}

const route = useRoute()
const router = useRouter()
const { get } = useApi()

const loading = ref(true)
const error = ref('')
const story = ref<Story | null>(null)
const userRating = ref(0)
const isBookmarked = ref(false)

const storyId = computed(() => route.params.id as string)

// Mock story data
const mockStory: Story = {
  id: 'story1',
  title: 'Breaking: Major Political Development Unfolds Across Multiple News Outlets',
  summary: 'A significant political event has captured national attention with various news outlets providing different perspectives on the implications for the upcoming election cycle and policy changes.',
  category: 'politics',
  publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  sources: [
    {
      id: 'source1',
      name: 'The Daily Herald',
      url: 'https://example.com/article1',
      excerpt: 'Sources close to the administration suggest this development could significantly impact the political landscape moving forward...',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      biasScore: 2.3
    },
    {
      id: 'source2',
      name: 'Independent News',
      url: 'https://example.com/article2',
      excerpt: 'Political analysts are divided on the long-term implications of today\'s announcement, with some calling it a watershed moment...',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      biasScore: -0.8
    },
    {
      id: 'source3',
      name: 'Global Report',
      url: 'https://example.com/article3',
      excerpt: 'The international community is watching closely as this domestic political development may have far-reaching consequences...',
      publishedAt: new Date(Date.now() - 5400000).toISOString(),
      biasScore: 1.2
    }
  ],
  biasAnalysis: {
    overallScore: 1.1,
    explanation: 'This story shows a slight conservative bias across sources, with some outlets emphasizing different aspects of the political implications. The language used tends to favor certain perspectives over others.',
    confidence: 0.78
  },
  stats: {
    averageRating: 3.4,
    totalRatings: 127
  }
}

const loadStory = async () => {
  try {
    loading.value = true
    error.value = ''
    
    // Try to fetch from API first
    try {
      const response = await get(`/api/stories/${storyId.value}`)
      
      if (response.story) {
        // Transform API response to match component expectations
        story.value = {
          id: response.story.id.toString(),
          title: response.story.name,
          summary: response.story.neutralSummary,
          category: 'news', // Default category
          publishedAt: response.story.createdAt || new Date().toISOString(),
          sources: response.articles.map((article: any) => ({
            id: article.id.toString(),
            name: article.sourceName,
            url: article.link,
            excerpt: article.summary,
            publishedAt: article.published,
            biasScore: article.sensationalism || 0,
            bias: article.sourceBias,
            imageUrl: article.imageUrl,
          })),
          biasDistribution: response.biasDistribution,
          articlesByBias: response.articlesByBias,
          totalArticles: response.totalArticles,
          coverageScore: response.coverageScore,
        }
        return
      }
    } catch (apiError) {
      console.warn('API error:', apiError)
      error.value = 'Failed to load story details'
    }
  } catch (err) {
    console.error('Failed to load story:', err)
    error.value = 'Failed to load story details'
  } finally {
    loading.value = false
  }
}

const generateAdditionalMockStories = () => {
  return [
    {
      id: '2',
      title: 'Technology Giant Announces Revolutionary AI Breakthrough in Medical Research',
      summary: 'A major technology company has announced a significant advancement in artificial intelligence applications for medical diagnosis and treatment planning, promising to revolutionize healthcare delivery.',
      category: 'technology',
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      sources: [
        {
          id: 'tech1',
          name: 'TechCrunch',
          url: 'https://example.com/tech1',
          excerpt: 'This breakthrough represents a major leap forward in AI-assisted medical diagnosis, with potential to save countless lives...',
          publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          biasScore: -0.5
        },
        {
          id: 'tech2',
          name: 'Forbes',
          url: 'https://example.com/tech2',
          excerpt: 'Industry analysts are cautiously optimistic about the commercial viability and regulatory approval timeline for this technology...',
          publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          biasScore: 0.2
        }
      ],
      biasAnalysis: {
        overallScore: -0.15,
        explanation: 'Coverage shows slight optimistic bias toward technology benefits, with limited discussion of potential risks or implementation challenges.',
        confidence: 0.75
      },
      stats: {
        averageRating: 4.1,
        totalRatings: 89
      }
    },
    {
      id: '3',
      title: 'Economic Markets Show Unprecedented Volatility Amid Global Uncertainty',
      summary: 'Financial markets worldwide experienced significant fluctuations today as investors react to geopolitical tensions and changing economic indicators.',
      category: 'business',
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      sources: [
        {
          id: 'fin1',
          name: 'Wall Street Journal',
          url: 'https://example.com/wsj1',
          excerpt: 'Market volatility reflects underlying economic uncertainties and investor concerns about future policy directions...',
          publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          biasScore: 0.8
        },
        {
          id: 'fin2',
          name: 'Reuters',
          url: 'https://example.com/reuters1',
          excerpt: 'Economic experts suggest this volatility may be temporary, driven by short-term market sentiment rather than fundamentals...',
          publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          biasScore: 0.1
        }
      ],
      biasAnalysis: {
        overallScore: 0.45,
        explanation: 'Financial coverage tends to emphasize market stability and business-friendly interpretations of economic events.',
        confidence: 0.82
      },
      stats: {
        averageRating: 3.7,
        totalRatings: 156
      }
    }
  ]
}

const generateDynamicStory = (id: number) => {
  const titles = [
    'Breaking: Major Development in International Relations',
    'Scientific Discovery Promises Revolutionary Changes',
    'Policy Changes Spark Nationwide Debate',
    'Environmental Initiative Gains Momentum',
    'Cultural Phenomenon Takes Center Stage'
  ]
  
  return {
    id: id.toString(),
    title: titles[id % titles.length] || 'Latest News Development',
    summary: 'This is a developing story with coverage from multiple perspectives and sources providing different viewpoints on the implications.',
    category: 'general',
    publishedAt: new Date(Date.now() - id * 60 * 60 * 1000).toISOString(),
    sources: [
      {
        id: `source${id}a`,
        name: 'Source A',
        url: `https://example.com/source${id}a`,
        excerpt: 'Initial coverage of this developing story with analysis of potential implications...',
        publishedAt: new Date(Date.now() - id * 60 * 60 * 1000).toISOString(),
        biasScore: -0.3
      },
      {
        id: `source${id}b`,
        name: 'Source B',
        url: `https://example.com/source${id}b`,
        excerpt: 'Alternative perspective on the same story, highlighting different aspects and concerns...',
        publishedAt: new Date(Date.now() - (id-1) * 60 * 60 * 1000).toISOString(),
        biasScore: 0.4
      }
    ],
    biasAnalysis: {
      overallScore: 0.05,
      explanation: 'Balanced coverage with multiple perspectives represented, though some bias detected in source selection.',
      confidence: 0.70
    },
    stats: {
      averageRating: 3.5,
      totalRatings: 42
    }
  }
}

const rateStory = async (rating: number) => {
  try {
    userRating.value = rating
    // await api.post(`/stories/${storyId.value}/rate`, { rating })
  } catch (error) {
    console.error('Failed to rate story:', error)
  }
}

const toggleBookmark = async () => {
  try {
    isBookmarked.value = !isBookmarked.value
    // await api.post(`/stories/${storyId.value}/bookmark`, { bookmarked: isBookmarked.value })
  } catch (error) {
    console.error('Failed to toggle bookmark:', error)
  }
}

const shareStory = async () => {
  const url = window.location.href
  const title = story.value?.title || 'Check out this story'
  
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
    } catch (error) {
      // User cancelled or error occurred
    }
  } else {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(url)
    // You could show a toast notification here
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

const getBiasColor = (score: number) => {
  if (score > 2) return 'bg-red-500'
  if (score > 0) return 'bg-red-300'
  if (score < -2) return 'bg-blue-500'
  if (score < 0) return 'bg-blue-300'
  return 'bg-green-500'
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

const getBiasLabel = (score: number) => {
  if (score > 2) return 'Right'
  if (score > 0.5) return 'Lean Right'
  if (score < -2) return 'Left'
  if (score < -0.5) return 'Lean Left'
  return 'Center'
}

const getBiasChipClasses = (score: number) => {
  if (score > 2) return 'bg-red-500/90 text-white'
  if (score > 0.5) return 'bg-red-300/90 text-red-900'
  if (score < -2) return 'bg-blue-500/90 text-white'
  if (score < -0.5) return 'bg-blue-300/90 text-blue-900'
  return 'bg-green-500/90 text-white'
}

const getHeroImage = () => {
  if (!story.value?.sources) return null
  const sourceWithImage = story.value.sources.find(source => source.imageUrl)
  return sourceWithImage?.imageUrl || null
}

onMounted(() => {
  loadStory()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Beautiful card hover effects */
.bg-white:hover {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Smooth image transitions */
img {
  transition: transform 0.3s ease, filter 0.3s ease;
}

img:hover {
  filter: brightness(1.05);
}

/* Enhanced gradient backgrounds */
.bg-gradient-to-br {
  background-size: 200% 200%;
  animation: gradient-shift 6s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Backdrop blur support for bias chips */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* Enhanced button styles */
.inline-flex:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* Card loading animation */
@keyframes pulse-card {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.animate-pulse-card {
  animation: pulse-card 2s ease-in-out infinite;
}
</style>
