<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <!-- Modal Header -->
      <div class="modal-header">
        <h2 class="modal-title">{{ story?.name || 'Loading...' }}</h2>
        <button @click="closeModal" class="close-btn">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-content">
        <div class="spinner"></div>
        <p>Loading story details...</p>
      </div>

      <!-- Story Content -->
      <div v-else-if="story" class="story-content">
        <!-- Story Overview Card -->
        <div class="story-overview-card">
          <div class="story-header-section">
            <!-- Story Image (single, prominent) -->
            <div class="story-hero-image" v-if="getStoryImage()">
              <img 
                :src="getStoryImage()"
                :alt="story.name"
                class="hero-image"
                @error="handleImageError"
              />
            </div>
            
            <!-- Story Title and Meta -->
            <div class="story-header-info">
              <h1 class="story-title">{{ story.name }}</h1>
              <div class="story-meta-info">
                <div class="meta-stat">
                  <span class="stat-number">{{ storyDetails.totalArticles }}</span>
                  <span class="stat-label">Sources</span>
                </div>
                <div class="meta-stat">
                  <span class="stat-number">{{ storyDetails.coverageScore }}%</span>
                  <span class="stat-label">Coverage</span>
                </div>
                <div class="meta-stat">
                  <span class="stat-number">{{ formatTimeAgo(story.lastUpdated) }}</span>
                  <span class="stat-label">Last Updated</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bias Distribution Visualization -->
          <div class="bias-distribution-card">
            <h3 class="card-title">Source Distribution by Political Leaning</h3>
            <div class="bias-chart">
              <div class="bias-bar">
                <div 
                  class="bias-segment left" 
                  :style="{ width: getBiasPercentage('left') + '%' }"
                  :title="`${storyDetails.biasDistribution.left || 0} left-leaning sources`"
                ></div>
                <div 
                  class="bias-segment center" 
                  :style="{ width: getBiasPercentage('center') + '%' }"
                  :title="`${storyDetails.biasDistribution.center || 0} center sources`"
                ></div>
                <div 
                  class="bias-segment right" 
                  :style="{ width: getBiasPercentage('right') + '%' }"
                  :title="`${storyDetails.biasDistribution.right || 0} right-leaning sources`"
                ></div>
              </div>
              <div class="bias-labels">
                <div class="bias-label left">
                  <div class="label-dot left"></div>
                  <span>{{ storyDetails.biasDistribution.left || 0 }} Left</span>
                </div>
                <div class="bias-label center">
                  <div class="label-dot center"></div>
                  <span>{{ storyDetails.biasDistribution.center || 0 }} Center</span>
                </div>
                <div class="bias-label right">
                  <div class="label-dot right"></div>
                  <span>{{ storyDetails.biasDistribution.right || 0 }} Right</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Neutral Summary -->
          <div v-if="story.neutralSummary" class="neutral-summary-card">
            <h3 class="card-title">Neutral Summary</h3>
            <p class="summary-text">{{ story.neutralSummary }}</p>
          </div>
        </div>

        <!-- Article Perspectives Section -->
        <div class="perspectives-section">
          <h3 class="section-title">Article Perspectives</h3>
          
          <!-- Perspective Tabs -->
          <div class="perspective-tabs">
            <button 
              v-for="perspective in availablePerspectives" 
              :key="perspective"
              @click="selectedPerspective = perspective"
              :class="['tab-btn', { active: selectedPerspective === perspective }]"
            >
              {{ perspective.charAt(0).toUpperCase() + perspective.slice(1) }}
              <span class="article-count">({{ storyDetails.articlesByBias[perspective]?.length || 0 }})</span>
            </button>
          </div>

          <!-- Articles for Selected Perspective -->
          <div class="articles-grid">
            <div 
              v-for="article in selectedPerspectiveArticles" 
              :key="article.id"
              class="article-card"
            >
              <!-- Article Header -->
              <div class="article-header">
                <h4 class="article-title">
                  <a :href="article.link" target="_blank" rel="noopener noreferrer" class="article-link">
                    {{ article.title }}
                    <svg class="external-link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                  </a>
                </h4>
                <div class="article-meta">
                  <span class="source-name">{{ article.sourceName }}</span>
                  <span class="separator">•</span>
                  <span class="publish-time">{{ formatTimestamp(article.published) }}</span>
                </div>
              </div>

              <!-- Article Summary -->
              <div v-if="article.summary" class="article-summary">
                {{ article.summary }}
              </div>

              <!-- Bias Analysis -->
              <div v-if="article.politicalLeaning !== null || article.sensationalism !== null" class="bias-analysis">
                <h5 class="analysis-title">Bias Analysis</h5>
                
                <div v-if="article.politicalLeaning !== null" class="metric-item">
                  <div class="metric-header">
                    <span class="metric-label">Political Leaning</span>
                    <span class="metric-value">{{ formatPoliticalLeaning(parseFloat(article.politicalLeaning)) }}</span>
                  </div>
                  <div class="leaning-bar">
                    <div class="leaning-track">
                      <div 
                        class="leaning-indicator" 
                        :style="{ left: (50 + (parseFloat(article.politicalLeaning) * 50)) + '%' }"
                      ></div>
                    </div>
                    <div class="leaning-labels">
                      <span>Left</span>
                      <span>Center</span>
                      <span>Right</span>
                    </div>
                  </div>
                </div>
                
                <div v-if="article.sensationalism !== null" class="metric-item">
                  <div class="metric-header">
                    <span class="metric-label">Sensationalism</span>
                    <span class="metric-value">{{ Math.round(parseFloat(article.sensationalism) * 100) }}%</span>
                  </div>
                  <div class="sensationalism-bar">
                    <div class="sensationalism-track">
                      <div 
                        class="sensationalism-fill" 
                        :style="{ width: (parseFloat(article.sensationalism) * 100) + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Framing Summary -->
              <div v-if="article.framingSummary" class="framing-summary">
                <h5 class="analysis-title">Framing Analysis</h5>
                <p class="framing-text">{{ article.framingSummary }}</p>
              </div>
            </div>

            <!-- Empty State for Perspective -->
            <div v-if="selectedPerspectiveArticles.length === 0" class="empty-perspective">
              <div class="empty-icon">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h4 class="empty-title">No {{ selectedPerspective }} sources found</h4>
              <p class="empty-description">
                This could represent a potential blindspot in coverage from {{ selectedPerspective }}-leaning sources.
              </p>
            </div>
          </div>
        </div>

        <!-- AI Analysis Section -->
        <div class="ai-analysis-section" v-if="showAiAnalysis">
          <div class="analysis-header">
            <h3 class="section-title">AI Analysis</h3>
            <button 
              @click="runAiAnalysis" 
              :disabled="aiAnalysisLoading"
              class="analyze-btn"
            >
              <svg v-if="!aiAnalysisLoading" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <div v-else class="spinner-small"></div>
              {{ aiAnalysisLoading ? 'Analyzing...' : 'Run Analysis' }}
            </button>
          </div>
          
          <div v-if="aiAnalysisResult" class="analysis-result">
            <div class="analysis-content">
              {{ aiAnalysisResult }}
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else class="error-state">
        <div class="error-icon">
          <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.182 18.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
        </div>
        <h3 class="error-title">Story not found</h3>
        <p class="error-description">The requested story could not be loaded.</p>
        <button @click="closeModal" class="error-close-btn">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useApi } from '../composables/useApi'

// Props
const props = defineProps({
  storyId: {
    type: Number,
    required: true
  },
  show: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close'])

// Reactive state
const loading = ref(true)
const story = ref(null)
const storyDetails = ref({
  totalArticles: 0,
  coverageScore: 0,
  biasDistribution: { left: 0, center: 0, right: 0 },
  articlesByBias: { left: [], center: [], right: [] }
})
const selectedPerspective = ref('left')
const aiAnalysisLoading = ref(false)
const aiAnalysisResult = ref('')
const showAiAnalysis = ref(false)

// API composable
const { fetchStoryById, analyzeStory } = useApi()

// Computed properties
const availablePerspectives = computed(() => {
  return ['left', 'center', 'right'].filter(perspective => 
    storyDetails.value.articlesByBias[perspective]?.length > 0
  )
})

const selectedPerspectiveArticles = computed(() => {
  return storyDetails.value.articlesByBias[selectedPerspective.value] || []
})

// Methods
const closeModal = () => {
  emit('close')
}

const loadStory = async () => {
  if (!props.storyId) return
  
  loading.value = true
  try {
    const response = await fetchStoryById(props.storyId)
    story.value = response.story
    
    // Process story details
    const articles = response.articles || []
    storyDetails.value = {
      totalArticles: articles.length,
      coverageScore: calculateCoverageScore(articles),
      biasDistribution: calculateBiasDistribution(articles),
      articlesByBias: groupArticlesByBias(articles)
    }
    
    // Set default perspective to the first available one
    if (availablePerspectives.value.length > 0) {
      selectedPerspective.value = availablePerspectives.value[0]
    }
    
    showAiAnalysis.value = articles.length > 0
  } catch (error) {
    console.error('Error loading story:', error)
    story.value = null
  } finally {
    loading.value = false
  }
}

const calculateCoverageScore = (articles) => {
  const uniqueBiases = new Set(articles.map(a => a.bias).filter(Boolean))
  return Math.round((uniqueBiases.size / 3) * 100)
}

const calculateBiasDistribution = (articles) => {
  const distribution = { left: 0, center: 0, right: 0 }
  articles.forEach(article => {
    if (article.bias && distribution.hasOwnProperty(article.bias)) {
      distribution[article.bias]++
    }
  })
  return distribution
}

const groupArticlesByBias = (articles) => {
  const grouped = { left: [], center: [], right: [] }
  articles.forEach(article => {
    if (article.bias && grouped.hasOwnProperty(article.bias)) {
      grouped[article.bias].push(article)
    }
  })
  return grouped
}

const getBiasPercentage = (bias) => {
  const total = Object.values(storyDetails.value.biasDistribution).reduce((sum, count) => sum + count, 0)
  if (total === 0) return 0
  return ((storyDetails.value.biasDistribution[bias] || 0) / total) * 100
}

// Utility function to validate image URLs
const isValidImageUrl = (url) => {
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

const getStoryImage = () => {
  // Get the first valid image from any article
  const allArticles = Object.values(storyDetails.value.articlesByBias).flat()
  for (const article of allArticles) {
    if (isValidImageUrl(article.imageUrl)) {
      return article.imageUrl
    }
  }
  return null
}

const handleImageError = (event) => {
  const img = event.target
  
  // Try to find another image from different articles
  const allArticles = Object.values(storyDetails.value.articlesByBias).flat()
  const currentSrc = img.src
  
  for (const article of allArticles) {
    if (isValidImageUrl(article.imageUrl) && article.imageUrl !== currentSrc) {
      img.src = article.imageUrl
      return
    }
  }
  
  // If no alternative found, hide the image
  img.style.display = 'none'
  console.warn('All image sources failed for story modal')
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Unknown'
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now - date
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    return `${diffDays}d ago`
  } else if (diffHours > 0) {
    return `${diffHours}h ago`
  } else {
    return 'Recent'
  }
}

const formatPoliticalLeaning = (value) => {
  if (value < -0.3) return 'Left-leaning'
  if (value > 0.3) return 'Right-leaning'
  return 'Center'
}

const runAiAnalysis = async () => {
  aiAnalysisLoading.value = true
  try {
    const result = await analyzeStory(props.storyId)
    aiAnalysisResult.value = result.analysis || 'Analysis completed successfully'
  } catch (error) {
    console.error('Error running AI analysis:', error)
    aiAnalysisResult.value = 'Failed to run analysis. Please try again.'
  } finally {
    aiAnalysisLoading.value = false
  }
}

// Watchers
watch(() => props.storyId, loadStory, { immediate: true })
watch(() => props.show, (newShow) => {
  if (newShow && props.storyId) {
    loadStory()
  }
})

// Lifecycle
onMounted(() => {
  if (props.show && props.storyId) {
    loadStory()
  }
})
</script>

<style scoped>
/* Modal Layout */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 1200px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 12px 12px 0 0;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  color: #6b7280;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

/* Loading State */
.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Story Content */
.story-content {
  padding: 32px;
}

/* Story Overview Card */
.story-overview-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 32px;
  color: white;
  margin-bottom: 32px;
}

.story-header-section {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 32px;
}

.story-hero-image {
  flex-shrink: 0;
  width: 200px;
  height: 150px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.story-header-info {
  flex: 1;
}

.story-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  line-height: 1.2;
}

.story-meta-info {
  display: flex;
  gap: 32px;
}

.meta-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fbbf24;
}

.stat-label {
  font-size: 0.875rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Bias Distribution Card */
.bias-distribution-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.bias-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bias-bar {
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  background: rgba(255, 255, 255, 0.2);
}

.bias-segment {
  height: 100%;
  transition: width 0.3s ease;
}

.bias-segment.left {
  background: #ef4444;
}

.bias-segment.center {
  background: #8b5cf6;
}

.bias-segment.right {
  background: #3b82f6;
}

.bias-labels {
  display: flex;
  justify-content: space-between;
}

.bias-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.label-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.label-dot.left {
  background: #ef4444;
}

.label-dot.center {
  background: #8b5cf6;
}

.label-dot.right {
  background: #3b82f6;
}

/* Neutral Summary Card */
.neutral-summary-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  margin-top: 24px;
}

.summary-text {
  margin: 0;
  line-height: 1.6;
  font-size: 1rem;
}

/* Perspectives Section */
.perspectives-section {
  margin-top: 32px;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 24px 0;
}

.perspective-tabs {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  background: none;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tab-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.tab-btn.active {
  background: white;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.article-count {
  font-size: 0.75rem;
  background: #e5e7eb;
  color: #6b7280;
  padding: 2px 6px;
  border-radius: 10px;
}

.tab-btn.active .article-count {
  background: #ddd6fe;
  color: #7c3aed;
}

/* Articles Grid */
.articles-grid {
  display: grid;
  gap: 24px;
}

.article-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s;
}

.article-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.article-header {
  margin-bottom: 16px;
}

.article-title {
  margin: 0 0 8px 0;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.4;
}

.article-link {
  color: #111827;
  text-decoration: none;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transition: color 0.2s;
}

.article-link:hover {
  color: #3b82f6;
}

.external-link-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  opacity: 0.6;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: #6b7280;
}

.source-name {
  font-weight: 500;
  color: #374151;
}

.separator {
  opacity: 0.5;
}

.publish-time {
  color: #9ca3af;
}

.article-summary {
  margin-bottom: 16px;
  line-height: 1.6;
  color: #374151;
}

/* Bias Analysis */
.bias-analysis {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.analysis-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-item {
  margin-bottom: 16px;
}

.metric-item:last-child {
  margin-bottom: 0;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.leaning-bar {
  margin-bottom: 8px;
}

.leaning-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  position: relative;
  margin-bottom: 4px;
}

.leaning-indicator {
  position: absolute;
  top: -2px;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateX(-50%);
}

.leaning-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #9ca3af;
}

.sensationalism-bar {
  margin-bottom: 8px;
}

.sensationalism-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.sensationalism-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #ef4444 100%);
  transition: width 0.3s ease;
}

/* Framing Summary */
.framing-summary {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 16px;
  border-radius: 0 8px 8px 0;
}

.framing-text {
  margin: 0;
  line-height: 1.6;
  color: #92400e;
}

/* Empty State for Perspective */
.empty-perspective {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px dashed #d1d5db;
}

.empty-icon {
  color: #9ca3af;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.empty-description {
  color: #6b7280;
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

/* AI Analysis Section */
.ai-analysis-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid #e5e7eb;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.analyze-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.analyze-btn:hover:not(:disabled) {
  background: #2563eb;
}

.analyze-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.analysis-result {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 24px;
}

.analysis-content {
  line-height: 1.6;
  color: #0c4a6e;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
}

.error-icon {
  color: #ef4444;
  margin-bottom: 16px;
}

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px 0;
}

.error-description {
  color: #6b7280;
  text-align: center;
  margin: 0 0 24px 0;
}

.error-close-btn {
  padding: 12px 24px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.error-close-btn:hover {
  background: #dc2626;
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .modal-header {
    padding: 16px 20px;
  }
  
  .modal-title {
    font-size: 1.25rem;
  }
  
  .story-content {
    padding: 20px;
  }
  
  .story-overview-card {
    padding: 20px;
  }
  
  .story-header-section {
    flex-direction: column;
    gap: 16px;
  }
  
  .story-hero-image {
    width: 100%;
    height: 200px;
  }
  
  .story-title {
    font-size: 1.5rem;
  }
  
  .story-meta-info {
    gap: 16px;
  }
  
  .perspective-tabs {
    flex-direction: column;
  }
  
  .tab-btn {
    justify-content: flex-start;
  }
}
</style>
