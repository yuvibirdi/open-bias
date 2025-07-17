<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto mb-3"></div>
        <p class="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen p-4">
      <div class="text-center max-w-md mx-auto p-6 bg-white rounded-lg border">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Story Not Found</h3>
        <p class="text-gray-600 text-sm mb-4">{{ error }}</p>
        <button 
          @click="goBackToStories"
          class="text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          ← Back to Stories
        </button>
      </div>
    </div>

    <!-- Story Content -->
    <div v-else-if="story">
      <!-- Navigation Header -->
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-6xl mx-auto px-4 sm:px-6">
          <div class="flex items-center justify-between h-16">
            <!-- Back button on left -->
            <button 
              @click="goBackToStories"
              class="text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              ← Back to Stories
            </button>
            
            <!-- Action buttons on right -->
            <div class="flex items-center space-x-6">
              <button 
                @click="shareStory"
                class="text-gray-600 hover:text-gray-900 font-medium text-sm"
                title="Share story"
              >
                Share
              </button>
              <button 
                @click="toggleBookmark"
                class="font-medium text-sm"
                :class="isBookmarked ? 'text-yellow-600 hover:text-yellow-700' : 'text-gray-600 hover:text-gray-900'"
                title="Bookmark story"
              >
                {{ isBookmarked ? '★' : '☆' }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <!-- Story Article -->
        <article class="bg-white rounded-lg border border-gray-200 mb-8">
          <!-- Story Header -->
          <div class="text-center p-8 sm:p-12">
            <!-- Meta Information -->
            <div class="flex items-center justify-center flex-wrap gap-4 mb-6">
              <span class="px-3 py-1 rounded text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {{ story.category || 'News' }}
              </span>
              <time class="text-sm text-gray-600 font-medium">
                {{ formatDate(story.publishedAt || story.lastUpdated || '') }}
              </time>
              <div v-if="story.coverageScore" class="flex items-center text-sm">
                <span class="text-gray-600 font-medium mr-2">Coverage</span>
                <div class="flex items-center bg-green-50 px-3 py-1 rounded border border-green-200">
                  <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span class="font-medium text-green-700">{{ story.coverageScore }}%</span>
                </div>
              </div>
            </div>

            <!-- Title -->
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-8 max-w-4xl mx-auto">
              {{ story.title || story.name }}
            </h1>

            <!-- Hero Image Section -->
            <div class="mb-8 max-w-4xl mx-auto">
              <div v-if="getHeroImage() && !imageError" class="relative rounded-lg overflow-hidden bg-gray-100">
                <img 
                  :src="getHeroImage() || ''"
                  :alt="story.title || story.name"
                  class="w-full h-64 sm:h-80 lg:h-96 object-cover"
                  loading="eager"
                  @error="handleImageError"
                  @load="imageLoaded = true"
                />
              </div>
              
              <!-- Image Placeholder when no image or error -->
              <div v-else class="relative rounded-lg overflow-hidden bg-gray-100 h-64 sm:h-80 lg:h-96 flex items-center justify-center border border-gray-200">
                <div class="text-center text-gray-400">
                  <div class="text-6xl mb-4">📰</div>
                  <p class="text-lg font-medium">Breaking News</p>
                  <p class="text-sm">Visual content pending</p>
                </div>
              </div>
            </div>

            <!-- Summary -->
            <div class="max-w-3xl mx-auto">
              <p class="text-xl sm:text-2xl text-gray-700 leading-relaxed">
                {{ story.summary || story.neutralSummary || 'This story is developing and details are being gathered from multiple sources.' }}
              </p>
            </div>
          </div>
        </article>

        <!-- Sources Section -->
        <section class="bg-white rounded-lg border border-gray-200">
          <div class="p-8 sm:p-12">
            <div class="text-center mb-8">
              <h2 class="text-2xl font-bold text-gray-900 mb-2">Sources</h2>
              <p class="text-gray-600 font-medium">{{ story.sources?.length || 0 }} articles from multiple outlets</p>
              
              <!-- Bias Distribution Bar -->
              <div v-if="story.biasDistribution" class="mt-6 max-w-2xl mx-auto">
                <div class="bias-distribution">
                  <div class="bias-bar">
                    <div 
                      class="bias-segment left" 
                      :style="{ width: getBiasPercentage('left') + '%' }"
                      :title="`${story.biasDistribution.left || 0} left-leaning sources`"
                    ></div>
                    <div 
                      class="bias-segment center" 
                      :style="{ width: getBiasPercentage('center') + '%' }"
                      :title="`${story.biasDistribution.center || 0} center sources`"
                    ></div>
                    <div 
                      class="bias-segment right" 
                      :style="{ width: getBiasPercentage('right') + '%' }"
                      :title="`${story.biasDistribution.right || 0} right-leaning sources`"
                    ></div>
                  </div>
                </div>
                
                <div class="coverage-labels mt-3">
                  <span class="left-label">{{ story.biasDistribution.left || 0 }} Left</span>
                  <span class="center-label">{{ story.biasDistribution.center || 0 }} Center</span>
                  <span class="right-label">{{ story.biasDistribution.right || 0 }} Right</span>
                </div>
              </div>
            </div>
            
            <div v-if="story.sources && story.sources.length > 0" class="max-w-4xl mx-auto space-y-6">
              <div 
                v-for="source in story.sources" 
                :key="source.id"
                class="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <!-- Source Header -->
                    <div class="flex items-center flex-wrap gap-3 mb-4">
                      <h3 class="font-semibold text-gray-900 text-lg">{{ source.name }}</h3>
                      <span 
                        class="px-3 py-1 rounded text-xs font-medium"
                        :class="getBiasChipClasses(source.biasScore || 0)"
                      >
                        {{ getBiasLabel(source.biasScore || 0) }}
                      </span>
                      <time class="text-sm text-gray-600 font-medium">{{ formatDate(source.publishedAt) }}</time>
                    </div>
                    
                    <!-- Article Title -->
                    <h4 class="text-xl font-semibold text-gray-900 mb-3 leading-snug">
                      {{ source.title }}
                    </h4>
                    
                    <!-- Article Excerpt -->
                    <p v-if="source.excerpt || source.summary" class="text-gray-600 mb-4 leading-relaxed">
                      {{ source.excerpt || source.summary }}
                    </p>
                  </div>
                  
                  <!-- Read Article Button -->
                  <a 
                    :href="source.url" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="ml-6 px-6 py-3 text-sm font-large text-black bg-blue-600 rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                  >
                    Read Article →
                  </a>
                </div>
              </div>
            </div>

            <!-- No sources message -->
            <div v-else class="text-center py-12 text-gray-500 max-w-md mx-auto">
              <div class="text-6xl mb-4">📄</div>
              <p class="text-lg font-medium">No sources available for this story.</p>
            </div>
          </div>
        </section>
      </main>
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
  bias?: string
  imageUrl?: string
  title?: string
  summary?: string
}

interface Story {
  id: string
  title?: string
  name?: string
  summary?: string
  neutralSummary?: string
  category?: string
  publishedAt?: string
  lastUpdated?: string
  sources: Source[]
  coverageScore?: number
  biasDistribution?: {
    left: number
    center: number
    right: number
  }
}

const route = useRoute()
const router = useRouter()
const { get } = useApi()

const loading = ref(true)
const error = ref('')
const story = ref<Story | null>(null)
const isBookmarked = ref(false)
const imageError = ref(false)
const imageLoaded = ref(false)

const storyId = computed(() => route.params.id as string)

// Better back navigation
const goBackToStories = () => {
  router.push('/stories')
}

const loadStory = async () => {
  try {
    loading.value = true
    error.value = ''
    
    const response = await get(`/api/stories/${storyId.value}`) as any
    
    if (response.story && response.articles) {
      // Calculate bias distribution from sources
      const sources = response.articles.map((article: any) => ({
        id: article.id.toString(),
        name: article.sourceName,
        url: article.link,
        title: article.title,
        excerpt: article.summary,
        summary: article.summary,
        publishedAt: article.published,
        biasScore: parseFloat(article.politicalLeaning) || 0,
        bias: article.sourceBias,
        imageUrl: article.imageUrl,
      }))

      // Calculate bias distribution
      const biasDistribution = sources.reduce((acc: any, source: any) => {
        const score = source.biasScore
        if (score > 0.5) {
          acc.right = (acc.right || 0) + 1
        } else if (score < -0.5) {
          acc.left = (acc.left || 0) + 1
        } else {
          acc.center = (acc.center || 0) + 1
        }
        return acc
      }, { left: 0, center: 0, right: 0 })

      // Transform API response to match component expectations
      story.value = {
        id: response.story.id.toString(),
        title: response.story.name,
        name: response.story.name,
        summary: response.story.neutralSummary || 'No summary available',
        neutralSummary: response.story.neutralSummary,
        category: 'News',
        publishedAt: response.articles[0]?.published || new Date().toISOString(),
        lastUpdated: response.story.lastUpdated,
        coverageScore: response.coverageScore,
        biasDistribution,
        sources,
      }
    } else {
      error.value = 'Story not found'
    }
  } catch (err) {
    console.error('Failed to load story:', err)
    error.value = 'Failed to load story details'
  } finally {
    loading.value = false
  }
}

const toggleBookmark = async () => {
  try {
    isBookmarked.value = !isBookmarked.value
    // TODO: Implement actual bookmark API call
  } catch (error) {
    console.error('Failed to toggle bookmark:', error)
  }
}

const shareStory = async () => {
  const url = window.location.href
  const title = story.value?.title || story.value?.name || 'Check out this story from OpenBias'
  
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
    } catch (error) {
      // User cancelled or error occurred, fallback to clipboard
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        console.log('Link copied to clipboard')
      }
    }
  } else if (navigator.clipboard) {
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      console.log('Link copied to clipboard')
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'Unknown'
  
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    
    // For older dates, show the actual date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  } catch (error) {
    return 'Unknown'
  }
}

const handleImageError = () => {
  imageError.value = true
}

const getBiasLabel = (score: number) => {
  if (score > 0.5) return 'Right-leaning'
  if (score < -0.5) return 'Left-leaning'
  return 'Center'
}

const getBiasChipClasses = (score: number) => {
  if (score > 0.5) return 'bg-red-50 text-red-700 border border-red-200'
  if (score < -0.5) return 'bg-blue-50 text-blue-700 border border-blue-200'
  return 'bg-gray-50 text-gray-700 border border-gray-200'
}

const getBiasPercentage = (biasType: 'left' | 'center' | 'right') => {
  if (!story.value?.biasDistribution) return 0
  
  const distribution = story.value.biasDistribution
  const total = (distribution.left || 0) + (distribution.center || 0) + (distribution.right || 0)
  
  if (total === 0) return 0
  
  const count = distribution[biasType] || 0
  return Math.round((count / total) * 100)
}

const getHeroImage = () => {
  if (!story.value?.sources || imageError.value) return null
  const sourceWithImage = story.value.sources.find(source => 
    source.imageUrl && 
    source.imageUrl.trim() !== '' && 
    source.imageUrl !== 'null' && 
    source.imageUrl !== 'undefined'
  )
  return sourceWithImage?.imageUrl || null
}

onMounted(() => {
  loadStory()
})
</script>

<style scoped>
/* Clean, minimal styles */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Better focus states */
button:focus-visible,
a:focus-visible {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

/* Bias Distribution Bar Styles */
.bias-distribution {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.bias-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.bias-segment {
  transition: all 0.3s ease;
}

.bias-segment.left {
  background-color: #3b82f6;
}

.bias-segment.center {
  background-color: #6b7280;
}

.bias-segment.right {
  background-color: #ef4444;
}

.coverage-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 8px;
}

.left-label {
  color: #3b82f6;
}

.center-label {
  color: #6b7280;
}

.right-label {
  color: #ef4444;
}
</style>
