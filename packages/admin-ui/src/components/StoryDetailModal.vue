<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <!-- Modal Header -->
      <div class="modal-header">
        <h2>{{ story?.name || 'Loading...' }}</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-content">
        <div class="spinner"></div>
        <p>Loading story details...</p>
      </div>

      <!-- Story Content -->
      <div v-else-if="story" class="story-content">
        <!-- Story Overview -->
        <div class="story-overview">
          <div class="overview-stats">
            <div class="stat-item">
              <span class="stat-number">{{ storyDetails.totalArticles }}</span>
              <span class="stat-label">Sources</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ storyDetails.coverageScore }}%</span>
              <span class="stat-label">Coverage</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ formatDate(story.neutralSummary ? new Date() : null) }}</span>
              <span class="stat-label">Last Updated</span>
            </div>
          </div>

          <!-- Bias Distribution Chart -->
          <div class="bias-chart">
            <h3>Source Distribution</h3>
            <div class="bias-breakdown">
              <div class="bias-item left">
                <div class="bias-color"></div>
                <span class="bias-count">{{ storyDetails.biasDistribution.left || 0 }}</span>
                <span class="bias-label">Left</span>
              </div>
              <div class="bias-item center">
                <div class="bias-color"></div>
                <span class="bias-count">{{ storyDetails.biasDistribution.center || 0 }}</span>
                <span class="bias-label">Center</span>
              </div>
              <div class="bias-item right">
                <div class="bias-color"></div>
                <span class="bias-count">{{ storyDetails.biasDistribution.right || 0 }}</span>
                <span class="bias-label">Right</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Neutral Summary -->
        <div v-if="story.neutralSummary" class="neutral-summary">
          <h3>Neutral Summary</h3>
          <p>{{ story.neutralSummary }}</p>
        </div>

        <!-- Article Perspectives -->
        <div class="perspectives-section">
          <h3>Different Perspectives</h3>
          
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
          <div class="articles-list">
            <div 
              v-for="article in selectedPerspectiveArticles" 
              :key="article.id"
              class="article-card"
            >
              <div class="article-header">
                <h4 class="article-title">
                  <a :href="article.link" target="_blank" rel="noopener noreferrer">
                    {{ article.title }}
                  </a>
                </h4>
                <div class="article-meta">
                  <span class="source-name">{{ article.sourceName }}</span>
                  <span class="publish-time">{{ formatTimestamp(article.published) }}</span>
                </div>
              </div>

              <div v-if="article.summary" class="article-summary">
                {{ article.summary }}
              </div>

              <!-- Bias Analysis -->
              <div v-if="article.politicalLeaning !== null || article.sensationalism !== null" class="bias-analysis">
                <div class="bias-metrics">
                  <div v-if="article.politicalLeaning !== null" class="metric">
                    <span class="metric-label">Political Leaning:</span>
                    <div class="leaning-bar">
                      <div 
                        class="leaning-indicator" 
                        :style="{ left: (50 + (parseFloat(article.politicalLeaning) * 50)) + '%' }"
                      ></div>
                    </div>
                    <span class="leaning-value">{{ formatPoliticalLeaning(parseFloat(article.politicalLeaning)) }}</span>
                  </div>
                  
                  <div v-if="article.sensationalism !== null" class="metric">
                    <span class="metric-label">Sensationalism:</span>
                    <div class="sensationalism-bar">
                      <div 
                        class="sensationalism-fill" 
                        :style="{ width: (parseFloat(article.sensationalism) * 100) + '%' }"
                      ></div>
                    </div>
                    <span class="sensationalism-value">{{ Math.round(parseFloat(article.sensationalism) * 100) }}%</span>
                  </div>
                </div>
              </div>

              <!-- Framing Summary -->
              <div v-if="article.framingSummary" class="framing-summary">
                <h5>Framing Analysis:</h5>
                <p>{{ article.framingSummary }}</p>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="selectedPerspectiveArticles.length === 0" class="empty-perspective">
              <p>No articles found from {{ selectedPerspective }} sources for this story.</p>
              <p class="blindspot-note">This could represent a potential blindspot in coverage.</p>
            </div>
          </div>
        </div>

        <!-- AI Analysis Section -->
        <div class="ai-analysis-section">
          <h3>AI Analysis</h3>
          <div class="analysis-actions">
            <button 
              @click="triggerBiasAnalysis" 
              :disabled="analyzingBias"
              class="analysis-btn"
            >
              {{ analyzingBias ? 'Analyzing...' : 'Run Bias Analysis' }}
            </button>
            <button 
              @click="generateSummary" 
              :disabled="generatingSummary"
              class="analysis-btn"
            >
              {{ generatingSummary ? 'Generating...' : 'Generate Neutral Summary' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useApi } from '@/composables/useApi'

interface Article {
  id: number
  title: string
  link: string
  summary: string | null
  published: Date
  sourceName: string
  sourceBias: string
  sourceUrl: string
  politicalLeaning: string | null
  sensationalism: string | null
  framingSummary: string | null
  imageUrl: string | null
}

interface StoryDetails {
  totalArticles: number
  coverageScore: number
  biasDistribution: Record<string, number>
  articlesByBias: Record<string, Article[]>
}

const props = defineProps<{
  storyId: number
}>()

const emit = defineEmits<{
  close: []
}>()

const { get, post } = useApi()

// Reactive state
const story = ref<any>(null)
const storyDetails = ref<StoryDetails>({
  totalArticles: 0,
  coverageScore: 0,
  biasDistribution: {},
  articlesByBias: {}
})
const loading = ref(true)
const selectedPerspective = ref('center')
const analyzingBias = ref(false)
const generatingSummary = ref(false)

// Computed properties
const availablePerspectives = computed(() => {
  return Object.keys(storyDetails.value.articlesByBias).filter(perspective => 
    storyDetails.value.articlesByBias[perspective]?.length > 0
  )
})

const selectedPerspectiveArticles = computed(() => {
  return storyDetails.value.articlesByBias[selectedPerspective.value] || []
})

// Methods
const loadStoryDetails = async () => {
  loading.value = true
  
  try {
    const response = await get(`/api/stories/${props.storyId}`)
    story.value = response.story
    storyDetails.value = {
      totalArticles: response.totalArticles,
      coverageScore: response.coverageScore,
      biasDistribution: response.biasDistribution,
      articlesByBias: response.articlesByBias
    }

    // Set default perspective to one that has articles
    if (availablePerspectives.value.length > 0 && !availablePerspectives.value.includes(selectedPerspective.value)) {
      selectedPerspective.value = availablePerspectives.value[0]
    }
  } catch (error) {
    console.error('Failed to load story details:', error)
  } finally {
    loading.value = false
  }
}

const closeModal = () => {
  emit('close')
}

const triggerBiasAnalysis = async () => {
  analyzingBias.value = true
  
  try {
    // This would trigger bias analysis for all articles in the story
    await post(`/api/stories/${props.storyId}/analyze-bias`)
    
    // Reload the story details to get updated analysis
    await loadStoryDetails()
  } catch (error) {
    console.error('Failed to trigger bias analysis:', error)
  } finally {
    analyzingBias.value = false
  }
}

const generateSummary = async () => {
  generatingSummary.value = true
  
  try {
    await post(`/api/stories/${props.storyId}/generate-summary`)
    
    // Reload the story details to get the new summary
    await loadStoryDetails()
  } catch (error) {
    console.error('Failed to generate summary:', error)
  } finally {
    generatingSummary.value = false
  }
}

const formatTimestamp = (timestamp: Date) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const formatDate = (date: Date | null) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString()
}

const formatPoliticalLeaning = (value: number) => {
  if (value < -0.3) return 'Left-leaning'
  if (value > 0.3) return 'Right-leaning'
  return 'Neutral'
}

// Lifecycle
onMounted(() => {
  loadStoryDetails()
})

// Handle story ID changes
watch(() => props.storyId, () => {
  loadStoryDetails()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 1000px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e0e0e0;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #1a1a1a;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.loading-content {
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

.story-content {
  padding: 24px;
}

.story-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.overview-stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: #0066cc;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
  margin-top: 4px;
}

.bias-chart h3 {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  color: #333;
}

.bias-breakdown {
  display: flex;
  gap: 16px;
}

.bias-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.bias-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.bias-item.left .bias-color {
  background: #4a90e2;
}

.bias-item.center .bias-color {
  background: #9b59b6;
}

.bias-item.right .bias-color {
  background: #e74c3c;
}

.bias-count {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
}

.bias-label {
  font-size: 0.8rem;
  color: #666;
}

.neutral-summary {
  margin-bottom: 30px;
  padding: 20px;
  background: #e8f5e8;
  border-radius: 8px;
  border-left: 4px solid #28a745;
}

.neutral-summary h3 {
  margin: 0 0 12px 0;
  color: #1e5e1e;
}

.neutral-summary p {
  margin: 0;
  line-height: 1.6;
  color: #2d5a2d;
}

.perspectives-section {
  margin-bottom: 30px;
}

.perspectives-section h3 {
  margin-bottom: 20px;
}

.perspective-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.tab-btn {
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-weight: 500;
  color: #666;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-btn:hover {
  color: #0066cc;
}

.tab-btn.active {
  color: #0066cc;
  border-bottom-color: #0066cc;
}

.article-count {
  font-size: 0.8rem;
  color: #999;
}

.articles-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.article-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  background: white;
}

.article-header {
  margin-bottom: 12px;
}

.article-title a {
  color: #0066cc;
  text-decoration: none;
  font-weight: 600;
  line-height: 1.3;
}

.article-title a:hover {
  text-decoration: underline;
}

.article-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 0.9rem;
  color: #666;
}

.source-name {
  font-weight: 500;
}

.article-summary {
  margin-bottom: 12px;
  color: #444;
  line-height: 1.5;
}

.bias-analysis {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.bias-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric {
  display: flex;
  align-items: center;
  gap: 12px;
}

.metric-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
  min-width: 120px;
}

.leaning-bar {
  flex: 1;
  height: 8px;
  background: linear-gradient(to right, #4a90e2 0%, #9b59b6 50%, #e74c3c 100%);
  border-radius: 4px;
  position: relative;
  max-width: 200px;
}

.leaning-indicator {
  position: absolute;
  top: -2px;
  width: 4px;
  height: 12px;
  background: #333;
  border-radius: 2px;
  transform: translateX(-50%);
}

.sensationalism-bar {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  position: relative;
  max-width: 200px;
}

.sensationalism-fill {
  height: 100%;
  background: linear-gradient(to right, #28a745, #ffc107, #dc3545);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.leaning-value,
.sensationalism-value {
  font-size: 0.8rem;
  font-weight: 500;
  color: #333;
  min-width: 80px;
}

.framing-summary {
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
}

.framing-summary h5 {
  margin: 0 0 6px 0;
  font-size: 0.9rem;
  color: #666;
}

.framing-summary p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #555;
}

.empty-perspective {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.blindspot-note {
  font-style: italic;
  color: #999;
  margin-top: 8px;
}

.ai-analysis-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 24px;
}

.ai-analysis-section h3 {
  margin-bottom: 16px;
}

.analysis-actions {
  display: flex;
  gap: 12px;
}

.analysis-btn {
  padding: 10px 16px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.analysis-btn:hover:not(:disabled) {
  background: #0052a3;
}

.analysis-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal-content {
    margin: 10px;
    max-height: 95vh;
  }
  
  .story-overview {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .overview-stats {
    justify-content: center;
  }
  
  .bias-breakdown {
    justify-content: center;
  }
  
  .perspective-tabs {
    flex-wrap: wrap;
  }
  
  .analysis-actions {
    flex-direction: column;
  }
}
</style>
