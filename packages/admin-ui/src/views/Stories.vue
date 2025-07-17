<template>
  <div class="stories-view">
    <!-- Header Section -->
    <div class="stories-header">
      <div class="header-content">
        <h1 class="stories-title">Latest News Stories</h1>
        <p class="stories-subtitle">
          Discover news from multiple perspectives and uncover potential bias blindspots
        </p>
      </div>
      
      <!-- Quick Stats -->
      <div class="quick-stats">
        <div class="stat-card">
          <div class="stat-number">{{ totalStories }}</div>
          <div class="stat-label">Active Stories</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ averageCoverage }}%</div>
          <div class="stat-label">Avg Coverage</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ blindspotCount }}</div>
          <div class="stat-label">Blindspots</div>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="controls-section">
      <div class="search-controls">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search stories, topics, or sources..."
            class="search-input"
            @keyup.enter="searchStories"
          />
          <button @click="searchStories" class="search-button">
            🔍
          </button>
        </div>
        
        <div class="filter-controls">
          <select v-model="selectedTimeframe" @change="loadStories(true)" class="filter-select">
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          <select v-model="selectedCoverage" @change="loadStories(true)" class="filter-select">
            <option value="all">All Stories (Including Ungrouped)</option>
            <option value="full">Full Coverage (3 Perspectives)</option>
            <option value="partial">Partial Coverage</option>
            <option value="limited">Limited Coverage</option>
          </select>
          
          <button @click="showFiltersModal = true" class="filter-button">
            <icon name="filter" />
            More Filters
          </button>
        </div>
      </div>

      <!-- AI Analysis Controls (for authenticated users) -->
      <div v-if="isAuthenticated" class="ai-controls">
        <button
          @click="triggerBatchAnalysis"
          :disabled="analyzingBatch"
          class="ai-analyze-button"
        >
          <icon :name="analyzingBatch ? 'loader' : 'brain'" :class="{ 'spinning': analyzingBatch }" />
          {{ analyzingBatch ? 'Analyzing...' : 'Analyze Visible Stories' }}
        </button>
        
        <div class="analysis-status">
          <span class="status-item">
            <icon name="clock" />
            {{ pendingAnalysis }} pending
          </span>
          <span class="status-item">
            <icon name="zap" />
            {{ processingAnalysis }} processing
          </span>
          <span class="status-item">
            <icon name="check-circle" />
            {{ completedAnalysis }} completed
          </span>
        </div>
      </div>
    </div>

    <!-- Story Feed -->
    <StoryFeed 
      :search-query="searchQuery"
      :timeframe="selectedTimeframe"
      :coverage-filter="selectedCoverage"
      @story-analyzed="onStoryAnalyzed"
    />

    <!-- Advanced Filters Modal -->
    <div v-if="showFiltersModal" class="modal-overlay" @click="showFiltersModal = false">
      <div class="filters-modal" @click.stop>
        <div class="modal-header">
          <h3>Advanced Filters</h3>
          <button @click="showFiltersModal = false" class="close-button">
            <icon name="x" />
          </button>
        </div>
        
        <div class="modal-content">
          <div class="filter-group">
            <label>Bias Distribution</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="filters.showLeft" />
                Left-leaning sources
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="filters.showCenter" />
                Center sources
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="filters.showRight" />
                Right-leaning sources
              </label>
            </div>
          </div>
          
          <div class="filter-group">
            <label>Story Types</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="filters.showBlindspots" />
                Stories with blindspots
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="filters.showAnalyzed" />
                AI analyzed stories
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="filters.showTrending" />
                Trending stories
              </label>
            </div>
          </div>
          
          <div class="filter-group">
            <label>Sources</label>
            <select multiple v-model="filters.selectedSources" class="multi-select">
              <option v-for="source in availableSources" :key="source.id" :value="source.id">
                {{ source.name }}
              </option>
            </select>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="resetFilters" class="secondary-button">Reset</button>
          <button @click="applyFilters" class="primary-button">Apply Filters</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'
import StoryFeed from '@/components/StoryFeed.vue'

const { isAuthenticated } = useAuth()
const { get, post } = useApi()

// Reactive state
const searchQuery = ref('')
const selectedTimeframe = ref('30d')
const selectedCoverage = ref('all')
const showFiltersModal = ref(false)
const analyzingBatch = ref(false)

// Stats
const totalStories = ref(0)
const averageCoverage = ref(0)
const blindspotCount = ref(0)
const pendingAnalysis = ref(0)
const processingAnalysis = ref(0)
const completedAnalysis = ref(0)

// Filters
const filters = ref({
  showLeft: true,
  showCenter: true,
  showRight: true,
  showBlindspots: true,
  showAnalyzed: true,
  showTrending: true,
  selectedSources: [] as number[],
})

const availableSources = ref([])

// Methods
const loadStories = async (reset = true) => {
  // This will be handled by StoryFeed component
}

const searchStories = async () => {
  // The search will be triggered by the searchQuery reactive binding
  // The StoryFeed component watches searchQuery and will automatically reload
  console.log('Search triggered for:', searchQuery.value)
}

const loadStats = async () => {
  try {
    const response = await get(`/api/analytics/overview?timeframe=${selectedTimeframe.value}`)
    
    if (response.error) {
      console.error('API error:', response.error)
      // Use fallback values if API fails
      totalStories.value = 0
      averageCoverage.value = 0
      blindspotCount.value = 0
    } else {
      totalStories.value = response.totalStories || 0
      averageCoverage.value = response.averageCoverage || 0
      blindspotCount.value = response.blindspotCount || 0
    }

    // Also load analysis stats for authenticated users
    if (isAuthenticated.value) {
      try {
        // This would be a separate endpoint for analysis job statistics
        // For now, keep mock values
        pendingAnalysis.value = 8
        processingAnalysis.value = 3
        completedAnalysis.value = 234
      } catch (error) {
        console.error('Failed to load analysis stats:', error)
      }
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
    // Use fallback values
    totalStories.value = 0
    averageCoverage.value = 0
    blindspotCount.value = 0
  }
}

const loadSources = async () => {
  try {
    const response = await get('/api/sources')
    availableSources.value = response.sources
  } catch (error) {
    console.error('Failed to load sources:', error)
  }
}

const triggerBatchAnalysis = async () => {
  if (!isAuthenticated.value) return

  analyzingBatch.value = true
  try {
    await post('/api/ai-analysis/batch', {
      action: 'analyze_visible_stories',
      filters: {
        timeframe: selectedTimeframe.value,
        coverage: selectedCoverage.value,
      }
    })
    
    // Update processing counts
    processingAnalysis.value += 10 // Mock increment
    pendingAnalysis.value = Math.max(0, pendingAnalysis.value - 10)
  } catch (error) {
    console.error('Failed to trigger batch analysis:', error)
  } finally {
    analyzingBatch.value = false
  }
}

const onStoryAnalyzed = (storyId: number) => {
  console.log('Story analyzed:', storyId)
  // Update analysis counts
  processingAnalysis.value = Math.max(0, processingAnalysis.value - 1)
  completedAnalysis.value += 1
}

const resetFilters = () => {
  filters.value = {
    showLeft: true,
    showCenter: true,
    showRight: true,
    showBlindspots: true,
    showAnalyzed: true,
    showTrending: true,
    selectedSources: [],
  }
}

const applyFilters = () => {
  // Apply filters and close modal
  showFiltersModal.value = false
  loadStories(true)
}

// Watch for timeframe changes to reload stats
watch(selectedTimeframe, () => {
  loadStats()
})

// Load initial data
onMounted(() => {
  loadStats()
  loadSources()
})
</script>

<style scoped>
.stories-view {
  padding: 0;
}

.stories-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  margin: -1rem -1rem 2rem -1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.header-content {
  flex: 1;
}

.stories-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.stories-subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
  margin: 0;
}

.quick-stats {
  display: flex;
  gap: 1rem;
  flex-shrink: 0;
}

.stat-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  min-width: 80px;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.controls-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.search-box {
  flex: 1;
  display: flex;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow: hidden;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  outline: none;
  font-size: 0.875rem;
}

.search-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.search-button:hover {
  background: #2563eb;
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
}

.filter-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
}

.filter-button:hover {
  background: #f9fafb;
}

.ai-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.ai-analyze-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ai-analyze-button:hover:not(:disabled) {
  background: #7c3aed;
}

.ai-analyze-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.analysis-status {
  display: flex;
  gap: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.filters-modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
}

.close-button:hover {
  background: #f3f4f6;
}

.modal-content {
  padding: 1.5rem;
}

.filter-group {
  margin-bottom: 1.5rem;
}

.filter-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #374151;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
  margin: 0;
}

.multi-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  min-height: 100px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.secondary-button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.secondary-button:hover {
  background: #f9fafb;
}

.primary-button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.primary-button:hover {
  background: #2563eb;
}

@media (max-width: 768px) {
  .stories-header {
    flex-direction: column;
    gap: 1rem;
  }

  .quick-stats {
    align-self: stretch;
    justify-content: space-between;
  }

  .search-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-controls {
    flex-wrap: wrap;
  }

  .ai-controls {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .analysis-status {
    justify-content: space-between;
  }
}
</style>
