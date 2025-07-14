<template>
  <div class="story-feed">
    <!-- Header Section -->
    <div class="header-section">
      <h1 class="feed-title">Breaking News & Analysis</h1>
      <div class="feed-controls">
        <div class="timeframe-selector">
          <label>Time Range:</label>
          <select v-model="selectedTimeframe" @change="loadStories">
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last Week</option>
          </select>
        </div>
        
        <div class="coverage-filter">
          <label>Coverage:</label>
          <select v-model="selectedCoverage" @change="loadStories">
            <option value="">All Stories</option>
            <option value="full">Full Coverage (3 Perspectives)</option>
            <option value="partial">Partial Coverage</option>
            <option value="limited">Limited Coverage</option>
          </select>
        </div>

        <div class="search-box">
          <input 
            v-model="searchQuery" 
            @keyup.enter="searchStories"
            placeholder="Search stories..." 
            type="text"
          />
          <button @click="searchStories" class="search-btn">Search</button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading stories...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="stories.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2m-4 0V4a1 1 0 011-1h1a1 1 0 011 1v3M8 7V4a1 1 0 011-1h1a1 1 0 011 1v3m0 0H8m0 0v8a2 2 0 002 2h2a2 2 0 002-2V7"/>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-gray-900 mb-2">No Stories Available</h3>
      <p class="text-gray-600 mb-4">
        There are currently no stories in the database. This could be because:
      </p>
      <ul class="text-gray-600 text-left mb-6 space-y-2">
        <li>• No articles have been ingested yet</li>
        <li>• The RSS feeds are not accessible</li>
        <li>• Articles haven't been grouped into stories yet</li>
      </ul>
      <div class="space-y-3">
        <button 
          @click="loadStories(true)" 
          :disabled="loading"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Refresh
        </button>
        <p class="text-sm text-gray-500">
          Try running <code class="bg-gray-100 px-2 py-1 rounded">bun db:load_new_data</code> to ingest articles
        </p>
      </div>
    </div>

    <!-- Stories List -->
    <div v-else class="stories-container">
      <div 
        v-for="story in stories" 
        :key="story.id" 
        class="story-card"
        @click="navigateToStory(story)"
      >
        <div class="story-card-content">
          <!-- Story Image -->
          <EnhancedImage
            v-if="getStoryImage(story) || true"
            :src="getStoryImage(story)"
            :alt="story.title"
            category="news"
            container-class="story-image-container"
            image-class="story-image"
            placeholder-class="min-h-[120px]"
            placeholder-text="News"
          />

          <!-- Story Content -->
          <div class="story-content">
            <!-- Story Header -->
            <div class="story-header">
              <h2 class="story-title">{{ story.title }}</h2>
              <div class="story-meta">
                <span class="article-count">{{ story.totalArticles }} sources</span>
                <span class="coverage-badge" :class="getCoverageBadgeClass(story.coverageScore)">
                  {{ getCoverageText(story.coverageScore) }}
                </span>
                <span class="timestamp">{{ formatTimestamp(story.lastUpdated) }}</span>
              </div>
            </div>

            <!-- Story Summary -->
            <div class="story-summary">
              <p>{{ story.neutralSummary || 'Summary not yet available' }}</p>
            </div>

            <!-- Coverage Visualization -->
            <div class="coverage-visualization">
              <div class="bias-distribution">
                <div class="bias-bar">
                  <div 
                    class="bias-segment left" 
                    :style="{ width: getBiasPercentage(story, 'left') + '%' }"
                    :title="`${story.leftCoverage} left-leaning sources`"
                  ></div>
                  <div 
                    class="bias-segment center" 
                    :style="{ width: getBiasPercentage(story, 'center') + '%' }"
                    :title="`${story.centerCoverage} center sources`"
                  ></div>
                  <div 
                    class="bias-segment right" 
                    :style="{ width: getBiasPercentage(story, 'right') + '%' }"
                    :title="`${story.rightCoverage} right-leaning sources`"
                  ></div>
                </div>
              </div>
              
              <div class="coverage-labels">
                <span class="left-label">{{ story.leftCoverage }} Left</span>
                <span class="center-label">{{ story.centerCoverage }} Center</span>
                <span class="right-label">{{ story.rightCoverage }} Right</span>
              </div>
            </div>

            <!-- Blindspot Alert -->
            <div v-if="story.blindspotType" class="blindspot-alert">
              <icon name="alert-triangle" />
              <span>Missing {{ story.blindspotType.replace('_', ' ') }} perspective</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="hasMore" class="load-more-container">
        <button @click="loadMoreStories" :disabled="loading" class="load-more-btn">
          {{ loading ? 'Loading...' : 'Load More Stories' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import EnhancedImage from './EnhancedImage.vue'

// Props
const props = defineProps<{
  timeframe?: string
  coverageFilter?: string
  searchQuery?: string
}>()

// Emits
const emit = defineEmits<{
  storySelected: [story: Story]
  storyAnalyzed: [story: Story]
}>()

interface Story {
  id: number
  title: string
  neutralSummary: string | null
  totalArticles: number
  leftCoverage: number
  centerCoverage: number
  rightCoverage: number
  coverageScore: number
  firstReported: Date | null
  lastUpdated: Date | null
  mostUnbiasedArticleId: number | null
  imageUrl?: string | null
  blindspotType?: string
}

const { get } = useApi()
const router = useRouter()

// Reactive state
const stories = ref<Story[]>([])
const loading = ref(false)
const selectedTimeframe = ref(props.timeframe || '24h')
const selectedCoverage = ref(props.coverageFilter || '')
const searchQuery = ref(props.searchQuery || '')
const hasMore = ref(true)
const currentPage = ref(1)

// Watch for prop changes
watch(() => props.searchQuery, (newValue) => {
  if (newValue !== undefined) {
    searchQuery.value = newValue
    loadStories(true)
  }
})

watch(() => props.timeframe, (newValue) => {
  if (newValue !== undefined) {
    selectedTimeframe.value = newValue
    loadStories(true)
  }
})

watch(() => props.coverageFilter, (newValue) => {
  if (newValue !== undefined) {
    selectedCoverage.value = newValue
    loadStories(true)
  }
})

// Computed properties
const isSearchMode = computed(() => searchQuery.value.length > 0)

// Methods
const loadStories = async (reset = true) => {
  console.log('loadStories called, reset:', reset)
  console.log('Current search query:', searchQuery.value)
  console.log('Current timeframe:', selectedTimeframe.value)
  
  if (reset) {
    stories.value = []
    currentPage.value = 1
    hasMore.value = true
  }

  loading.value = true
  
  try {
    const params = new URLSearchParams({
      limit: '20',
      timeframe: selectedTimeframe.value,
    })
    
    if (selectedCoverage.value) {
      params.append('coverage', selectedCoverage.value)
    }

    const endpoint = isSearchMode.value ? '/api/stories/search' : '/api/stories/trending'
    
    if (isSearchMode.value) {
      params.append('q', searchQuery.value)
    }

    console.log('Making request to:', `${endpoint}?${params}`)
    const response = await get(`${endpoint}?${params}`)
    console.log('Response received:', response)
    
    if (reset) {
      stories.value = response.stories || []
    } else {
      stories.value.push(...(response.stories || []))
    }
    
    hasMore.value = (response.stories || []).length === 20
    
  } catch (error) {
    console.error('Error loading stories:', error)
  } finally {
    loading.value = false
  }
}

const searchStories = async () => {
  await loadStories(true)
}

const loadMoreStories = async () => {
  await loadStories(false)
}

const navigateToStory = (story: Story) => {
  router.push(`/story/${story.id}`)
}

const formatTimestamp = (timestamp: Date | null) => {
  if (!timestamp) return 'Unknown'
  
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes}m ago`
  }
  
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// Utility function to validate image URLs
const isValidImageUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '') return false
  
  try {
    const urlObj = new URL(trimmed)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

const getStoryImage = (story: Story) => {
  // Use improved validation for image URLs
  if (isValidImageUrl(story.imageUrl)) {
    return story.imageUrl;
  }
  return null;
}

const getCoverageBadgeClass = (score: number) => {
  if (score >= 100) return 'full'
  if (score >= 50) return 'partial'
  return 'limited'
}

const getCoverageText = (score: number) => {
  if (score >= 100) return 'Full Coverage'
  if (score >= 50) return 'Partial Coverage'
  return 'Limited Coverage'
}

const getBiasPercentage = (story: Story, bias: 'left' | 'center' | 'right') => {
  const total = story.leftCoverage + story.centerCoverage + story.rightCoverage
  if (total === 0) return 0
  
  switch (bias) {
    case 'left': return (story.leftCoverage / total) * 100
    case 'center': return (story.centerCoverage / total) * 100
    case 'right': return (story.rightCoverage / total) * 100
    default: return 0
  }
}

// Lifecycle
onMounted(() => {
  console.log('StoryFeed mounted, props:', props)
  console.log('Initial search query:', searchQuery.value)
  console.log('Initial timeframe:', selectedTimeframe.value)
  loadStories()
})
</script>

<style scoped>
.story-feed {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  min-height: 100vh;
}

.header-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.feed-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 24px;
  text-align: center;
}

.feed-controls {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  background: #f9fafb;
  padding: 20px;
  border-radius: 12px;
}

.timeframe-selector,
.coverage-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeframe-selector label,
.coverage-filter label {
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.timeframe-selector select,
.coverage-filter select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  min-width: 140px;
}

.search-box {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-box input {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  min-width: 200px;
}

.search-btn {
  padding: 8px 16px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-btn:hover {
  background: #1d4ed8;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  color: #6b7280;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.stories-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 0 8px;
}

.story-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.story-card:hover {
  border-color: #2563eb;
  box-shadow: 0 10px 25px rgba(37, 99, 235, 0.15);
  transform: translateY(-2px);
}

.story-card-content {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 24px;
}

.story-image-container {
  flex-shrink: 0;
  width: 160px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  background: #f3f4f6;
}

.story-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.story-image:hover {
  transform: scale(1.05);
}

.story-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.story-header {
  margin-bottom: 16px;
}

.story-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-meta {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 0.875rem;
  color: #6b7280;
  flex-wrap: wrap;
}

.article-count {
  font-weight: 500;
  color: #374151;
}

.coverage-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.coverage-badge.full {
  background: #dcfce7;
  color: #166534;
}

.coverage-badge.partial {
  background: #fef3c7;
  color: #92400e;
}

.coverage-badge.limited {
  background: #fee2e2;
  color: #991b1b;
}

.timestamp {
  color: #9ca3af;
}

.story-summary {
  margin-bottom: 20px;
  color: #4b5563;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.coverage-visualization {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bias-distribution {
  margin-bottom: 8px;
}

.bias-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: #f3f4f6;
}

.bias-segment {
  height: 100%;
  transition: all 0.3s ease;
}

.bias-segment.left {
  background: #3b82f6;
}

.bias-segment.center {
  background: #8b5cf6;
}

.bias-segment.right {
  background: #ef4444;
}

.coverage-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #6b7280;
}

.left-label,
.center-label,
.right-label {
  font-weight: 500;
}

.blindspot-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #92400e;
  font-weight: 500;
}

.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

.load-more-btn {
  padding: 12px 24px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.load-more-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.load-more-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  max-width: 600px;
  margin: 0 auto;
}

.empty-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.empty-state code {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.875rem;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.empty-state ul {
  max-width: 400px;
  margin: 0 auto;
  list-style: none;
  padding: 0;
}

.empty-state button {
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.empty-state button:hover:not(:disabled) {
  background: #1d4ed8;
}

.empty-state button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .story-feed {
    padding: 16px;
  }
  
  .feed-title {
    font-size: 2rem;
  }
  
  .feed-controls {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .search-box {
    flex-direction: column;
    width: 100%;
  }
  
  .search-box input {
    min-width: auto;
    width: 100%;
  }
  
  .story-card-content {
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }
  
  .story-image-container {
    width: 100%;
    height: 200px;
  }
  
  .story-title {
    font-size: 1.25rem;
  }
  
  .story-meta {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .story-feed {
    padding: 12px;
  }
  
  .feed-controls {
    padding: 16px;
  }
  
  .story-card-content {
    padding: 16px;
  }
  
  .coverage-labels {
    font-size: 0.7rem;
  }
}
</style>
