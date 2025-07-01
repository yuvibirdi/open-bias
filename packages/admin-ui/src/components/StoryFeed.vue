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

        <!-- Story Summary -->
        <div class="story-summary">
          <p>{{ story.neutralSummary || 'Summary not yet available' }}</p>
        </div>

        <!-- Blindspot Alert -->
        <div v-if="story.blindspotType" class="blindspot-alert">
          <icon name="alert-triangle" />
          <span>Missing {{ story.blindspotType.replace('_', ' ') }} perspective</span>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="hasMore" class="load-more-section">
        <button @click="loadMoreStories" :disabled="loading" class="load-more-btn">
          Load More Stories
        </button>
      </div>
    </div>

    <!-- Story Detail Modal -->
    <StoryDetailModal 
      v-if="selectedStoryId" 
      :story-id="selectedStoryId"
      @close="selectedStoryId = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import StoryDetailModal from '@/components/StoryDetailModal.vue'

// Props
const props = defineProps<{
  searchQuery?: string
  timeframe?: string
  coverageFilter?: string
}>()

// Emits
const emit = defineEmits<{
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
const selectedStoryId = ref<number | null>(null)
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
    
    console.log('Stories set to:', stories.value)
    hasMore.value = (response.stories || []).length === 20
  } catch (error) {
    console.error('Failed to load stories:', error)
    // Show error to user instead of mock data
    stories.value = []
  } finally {
    loading.value = false
  }
}

const searchStories = async () => {
  await loadStories(true)
}

const loadMoreStories = async () => {
  currentPage.value++
  await loadStories(false)
}

const navigateToStory = (story: Story) => {
  // Navigate to individual story page
  router.push(`/story/${story.id}`)
}

const getCoverageBadgeClass = (score: number) => {
  if (score >= 100) return 'coverage-full'
  if (score >= 67) return 'coverage-good'
  if (score >= 33) return 'coverage-partial'
  return 'coverage-limited'
}

const getCoverageText = (score: number) => {
  if (score >= 100) return 'Full Coverage'
  if (score >= 67) return 'Good Coverage'
  if (score >= 33) return 'Partial Coverage'
  return 'Limited Coverage'
}

const getBiasPercentage = (story: Story, bias: 'left' | 'center' | 'right') => {
  const total = story.leftCoverage + story.centerCoverage + story.rightCoverage
  if (total === 0) return 0
  
  const count = bias === 'left' ? story.leftCoverage : 
                bias === 'center' ? story.centerCoverage : 
                story.rightCoverage
  
  return Math.round((count / total) * 100)
}

const formatTimestamp = (timestamp: Date | null) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
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
  padding: 20px;
}

.header-section {
  margin-bottom: 30px;
}

.feed-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1a1a1a;
  margin-bottom: 20px;
}

.feed-controls {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
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
  color: #666;
}

.timeframe-selector select,
.coverage-filter select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
}

.search-box {
  display: flex;
  gap: 8px;
}

.search-box input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  min-width: 250px;
}

.search-btn {
  padding: 8px 16px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.search-btn:hover {
  background: #0052a3;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #0066cc;
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
  gap: 20px;
}

.story-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.story-card:hover {
  border-color: #0066cc;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);
  transform: translateY(-2px);
}

.story-header {
  margin-bottom: 16px;
}

.story-title {
  font-size: 1.4rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  line-height: 1.3;
}

.story-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 0.9rem;
  color: #666;
}

.coverage-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.coverage-full {
  background: #e8f5e8;
  color: #2d5a2d;
}

.coverage-good {
  background: #fff4e6;
  color: #8b5a00;
}

.coverage-partial {
  background: #fff0f0;
  color: #a04040;
}

.coverage-limited {
  background: #f0f0f0;
  color: #666;
}

.coverage-visualization {
  margin-bottom: 16px;
}

.bias-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
  background: #f0f0f0;
}

.bias-segment {
  transition: width 0.3s ease;
}

.bias-segment.left {
  background: #4a90e2;
}

.bias-segment.center {
  background: #9b59b6;
}

.bias-segment.right {
  background: #e74c3c;
}

.coverage-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #666;
}

.story-summary p {
  color: #444;
  line-height: 1.5;
  margin: 0;
}

.blindspot-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 0.9rem;
  color: #856404;
}

.load-more-section {
  text-align: center;
  padding: 20px;
}

.load-more-btn {
  padding: 12px 24px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.load-more-btn:hover:not(:disabled) {
  background: #e9ecef;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .feed-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    flex-direction: column;
  }
  
  .search-box input {
    min-width: auto;
  }
  
  .coverage-labels {
    font-size: 0.7rem;
  }
}

/* Empty State Styles */
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
}

.empty-state ul {
  max-width: 400px;
  margin: 0 auto;
}
</style>
