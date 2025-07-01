<template>
  <CContainer fluid>
    <!-- Welcome Header -->
    <CRow class="mb-4">
      <CCol :xs="12">
        <div class="welcome-header">
          <h1 class="dashboard-title">News Bias Analysis Dashboard</h1>
          <p class="dashboard-subtitle">Track bias patterns, story coverage, and AI analysis across news sources</p>
        </div>
      </CCol>
    </CRow>

    <!-- Key Metrics Row -->
    <CRow class="mb-4">
      <CCol sm="6" lg="3">
        <CWidgetStatsA class="mb-4 metric-card" color="primary">
          <template #value>
            {{ stats.totalArticles.toLocaleString() }}
          </template>
          <template #title>Total Articles</template>
          <template #action>
            <CDropdown placement="bottom-end">
              <template #toggler="{ on }">
                <CButton
                  color="transparent"
                  size="sm"
                  v-on="on"
                >
                  <CIcon icon="cilOptions" />
                </CButton>
              </template>
              <CDropdownMenu>
                <CDropdownItem>View Details</CDropdownItem>
                <CDropdownItem>Export Data</CDropdownItem>
              </CDropdownMenu>
            </CDropdown>
          </template>
        </CWidgetStatsA>
      </CCol>
      <CCol sm="6" lg="3">
        <CWidgetStatsA class="mb-4 metric-card" color="info">
          <template #value>
            {{ stats.totalSources }}
          </template>
          <template #title>Active Sources</template>
          <template #action>
            <span class="trend-indicator positive">+{{ stats.newSources }} this week</span>
          </template>
        </CWidgetStatsA>
      </CCol>
      <CCol sm="6" lg="3">
        <CWidgetStatsA class="mb-4 metric-card" color="success">
          <template #value>
            {{ stats.storiesAnalyzed }}
          </template>
          <template #title>Stories Analyzed</template>
          <template #action>
            <span class="trend-indicator">{{ stats.analysisCompletion }}% complete</span>
          </template>
        </CWidgetStatsA>
      </CCol>
      <CCol sm="6" lg="3">
        <CWidgetStatsA class="mb-4 metric-card" color="warning">
          <template #value>
            {{ stats.averageCoverage }}%
          </template>
          <template #title>Avg Coverage Score</template>
          <template #action>
            <span class="coverage-quality" :class="getCoverageQualityClass(stats.averageCoverage)">
              {{ getCoverageQualityText(stats.averageCoverage) }}
            </span>
          </template>
        </CWidgetStatsA>
      </CCol>
    </CRow>

    <!-- Main Content Row -->
    <CRow>
      <!-- Story Feed Column -->
      <CCol :md="8">
        <CCard class="mb-4">
          <CCardHeader class="d-flex justify-content-between align-items-center">
            <strong>Live Story Feed</strong>
            <div class="header-actions">
              <CButton size="sm" color="outline-primary" @click="refreshFeed">
                <CIcon icon="cilReload" class="me-1" />
                Refresh
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody class="p-0">
            <StoryFeed />
          </CCardBody>
        </CCard>
      </CCol>

      <!-- Sidebar Column -->
      <CCol :md="4">
        <!-- Bias Distribution Chart -->
        <CCard class="mb-4">
          <CCardHeader>
            <strong>Bias Distribution</strong>
            <small class="text-muted ms-2">Last 24 hours</small>
          </CCardHeader>
          <CCardBody>
            <div class="bias-chart">
              <div class="bias-item">
                <div class="bias-bar left" :style="{ width: getBiasPercentage('left') + '%' }"></div>
                <div class="bias-info">
                  <span class="bias-label">Left</span>
                  <span class="bias-count">{{ stats.leftBias }}</span>
                </div>
              </div>
              <div class="bias-item">
                <div class="bias-bar center" :style="{ width: getBiasPercentage('center') + '%' }"></div>
                <div class="bias-info">
                  <span class="bias-label">Center</span>
                  <span class="bias-count">{{ stats.centerBias }}</span>
                </div>
              </div>
              <div class="bias-item">
                <div class="bias-bar right" :style="{ width: getBiasPercentage('right') + '%' }"></div>
                <div class="bias-info">
                  <span class="bias-label">Right</span>
                  <span class="bias-count">{{ stats.rightBias }}</span>
                </div>
              </div>
            </div>
          </CCardBody>
        </CCard>

        <!-- Coverage Quality -->
        <CCard class="mb-4">
          <CCardHeader>
            <strong>Coverage Quality</strong>
          </CCardHeader>
          <CCardBody>
            <div class="coverage-metrics">
              <div class="coverage-metric">
                <span class="metric-label">Full Coverage Stories</span>
                <div class="metric-bar">
                  <div class="metric-fill full" :style="{ width: (stats.fullCoverageStories / stats.totalStories * 100) + '%' }"></div>
                </div>
                <span class="metric-value">{{ stats.fullCoverageStories }}</span>
              </div>
              <div class="coverage-metric">
                <span class="metric-label">Partial Coverage</span>
                <div class="metric-bar">
                  <div class="metric-fill partial" :style="{ width: (stats.partialCoverageStories / stats.totalStories * 100) + '%' }"></div>
                </div>
                <span class="metric-value">{{ stats.partialCoverageStories }}</span>
              </div>
              <div class="coverage-metric">
                <span class="metric-label">Limited Coverage</span>
                <div class="metric-bar">
                  <div class="metric-fill limited" :style="{ width: (stats.limitedCoverageStories / stats.totalStories * 100) + '%' }"></div>
                </div>
                <span class="metric-value">{{ stats.limitedCoverageStories }}</span>
              </div>
            </div>
          </CCardBody>
        </CCard>

        <!-- AI Analysis Status -->
        <CCard class="mb-4">
          <CCardHeader>
            <strong>AI Analysis Queue</strong>
          </CCardHeader>
          <CCardBody>
            <div class="analysis-status">
              <div class="status-item">
                <CIcon icon="cilClock" class="status-icon pending" />
                <span class="status-label">Pending Analysis</span>
                <span class="status-count">{{ stats.pendingAnalysis }}</span>
              </div>
              <div class="status-item">
                <CIcon icon="cilMediaPlay" class="status-icon processing" />
                <span class="status-label">Processing</span>
                <span class="status-count">{{ stats.processingAnalysis }}</span>
              </div>
              <div class="status-item">
                <CIcon icon="cilCheckCircle" class="status-icon completed" />
                <span class="status-label">Completed Today</span>
                <span class="status-count">{{ stats.completedAnalysis }}</span>
              </div>
            </div>
            
            <div class="analysis-actions mt-3">
              <CButton 
                size="sm" 
                color="primary" 
                @click="triggerBatchAnalysis"
                :disabled="analyzingBatch"
                class="w-100"
              >
                <CIcon v-if="analyzingBatch" icon="cilLoop" class="me-1 fa-spin" />
                <CIcon v-else icon="cilRocket" class="me-1" />
                {{ analyzingBatch ? 'Running Analysis...' : 'Run Batch Analysis' }}
              </CButton>
            </div>
          </CCardBody>
        </CCard>

        <!-- Recent Blindspots -->
        <CCard>
          <CCardHeader>
            <strong>Recent Blindspots</strong>
          </CCardHeader>
          <CCardBody>
            <div v-if="recentBlindspots.length === 0" class="text-muted text-center py-3">
              No recent blindspots detected
            </div>
            <div v-else class="blindspots-list">
              <div 
                v-for="blindspot in recentBlindspots" 
                :key="blindspot.id"
                class="blindspot-item"
              >
                <div class="blindspot-header">
                  <span class="blindspot-type" :class="blindspot.blindspotType">
                    {{ formatBlindspotType(blindspot.blindspotType) }}
                  </span>
                  <span class="blindspot-severity" :class="blindspot.severity">
                    {{ blindspot.severity }}
                  </span>
                </div>
                <p class="blindspot-description">{{ blindspot.description }}</p>
                <small class="text-muted">{{ formatDate(blindspot.createdAt) }}</small>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </CContainer>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import StoryFeed from '@/components/StoryFeed.vue'

const { get, post } = useApi()

// Reactive state
const stats = ref({
  totalArticles: 0,
  totalSources: 0,
  leftBias: 0,
  centerBias: 0,
  rightBias: 0,
  storiesAnalyzed: 0,
  analysisCompletion: 0,
  averageCoverage: 0,
  newSources: 0,
  totalStories: 0,
  fullCoverageStories: 0,
  partialCoverageStories: 0,
  limitedCoverageStories: 0,
  pendingAnalysis: 0,
  processingAnalysis: 0,
  completedAnalysis: 0,
})

const recentBlindspots = ref([])
const analyzingBatch = ref(false)

// Computed properties
const totalBiasArticles = computed(() => 
  stats.value.leftBias + stats.value.centerBias + stats.value.rightBias
)

// Methods
const loadDashboardStats = async () => {
  try {
    // Load basic stats from multiple endpoints
    const [articlesRes, sourcesRes, biasRes] = await Promise.all([
      get('/api/articles?limit=0'), // Just for count
      get('/api/sources'),
      get('/api/analytics/bias-distribution?timeframe=24h')
    ])

    // Initialize stats from API responses
    stats.value = {
      totalArticles: 0,
      totalSources: sourcesRes.sources?.length || 0,
      leftBias: 0,
      centerBias: 0,
      rightBias: 0,
      storiesAnalyzed: storiesRes.stories?.length || 0,
      analysisCompletion: 0,
      averageCoverage: 0,
      newSources: 0,
      totalStories: storiesRes.stories?.length || 0,
      fullCoverageStories: 0,
      partialCoverageStories: 0,
      limitedCoverageStories: 0,
      pendingAnalysis: 0,
      processingAnalysis: 0,
      completedAnalysis: 0,
    }

    // Update with real bias distribution if available
    if (biasRes.distribution && biasRes.distribution.length > 0) {
      biasRes.distribution.forEach((item: any) => {
        if (item.bias === 'left') stats.value.leftBias = item.articleCount
        if (item.bias === 'center') stats.value.centerBias = item.articleCount
        if (item.bias === 'right') stats.value.rightBias = item.articleCount
        stats.value.totalArticles += item.articleCount || 0
      })
    }
    
    // Calculate coverage statistics from stories
    if (storiesRes.stories && storiesRes.stories.length > 0) {
      storiesRes.stories.forEach((story: any) => {
        if (story.coverageScore >= 90) stats.value.fullCoverageStories++
        else if (story.coverageScore >= 60) stats.value.partialCoverageStories++
        else stats.value.limitedCoverageStories++
      })
      
      stats.value.averageCoverage = Math.round(
        storiesRes.stories.reduce((sum: number, story: any) => sum + (story.coverageScore || 0), 0) / 
        storiesRes.stories.length
      )
    }
  } catch (error) {
    console.error('Failed to load dashboard stats:', error)
  }
}

const loadRecentBlindspots = async () => {
  try {
    // This would require a user ID in a real implementation
    // For now, return empty array since we don't have blindspot data
    recentBlindspots.value = []
  } catch (error) {
    console.error('Failed to load recent blindspots:', error)
    recentBlindspots.value = []
  }
}
        severity: 'high',
        description: 'Economic policy coverage missing progressive viewpoint',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) // 5 hours ago
      }
    ]
  } catch (error) {
    console.error('Failed to load blindspots:', error)
  }
}

const getBiasPercentage = (bias: string) => {
  const total = totalBiasArticles.value
  if (total === 0) return 0
  
  const count = bias === 'left' ? stats.value.leftBias : 
                bias === 'center' ? stats.value.centerBias : 
                stats.value.rightBias
  
  return Math.round((count / total) * 100)
}

const getCoverageQualityClass = (score: number) => {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

const getCoverageQualityText = (score: number) => {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs Improvement'
}

const formatBlindspotType = (type: string) => {
  return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date: Date) => {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const refreshFeed = () => {
  loadDashboardStats()
  loadRecentBlindspots()
}

const triggerBatchAnalysis = async () => {
  analyzingBatch.value = true
  
  try {
    // This would trigger batch analysis
    await post('/api/analysis/batch-run', {
      articleLimit: 10,
      summaryLimit: 5
    })
    
    // Refresh stats after analysis
    setTimeout(() => {
      loadDashboardStats()
    }, 2000)
  } catch (error) {
    console.error('Failed to trigger batch analysis:', error)
  } finally {
    analyzingBatch.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadDashboardStats()
  loadRecentBlindspots()
  
  // Set up periodic refresh
  setInterval(() => {
    loadDashboardStats()
  }, 30000) // Refresh every 30 seconds
})
</script>

<style scoped>
.welcome-header {
  text-align: center;
  padding: 20px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 20px;
}

.dashboard-title {
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.dashboard-subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
  margin: 0;
}

.metric-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.trend-indicator {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e9ecef;
  color: #495057;
}

.trend-indicator.positive {
  background: #d4edda;
  color: #155724;
}

.coverage-quality {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.coverage-quality.excellent {
  background: #d4edda;
  color: #155724;
}

.coverage-quality.good {
  background: #d1ecf1;
  color: #0c5460;
}

.coverage-quality.fair {
  background: #fff3cd;
  color: #856404;
}

.coverage-quality.poor {
  background: #f8d7da;
  color: #721c24;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.bias-chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bias-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bias-bar {
  flex: 1;
  height: 24px;
  border-radius: 12px;
  transition: width 0.3s ease;
}

.bias-bar.left {
  background: linear-gradient(90deg, #4a90e2, #357abd);
}

.bias-bar.center {
  background: linear-gradient(90deg, #9b59b6, #8e44ad);
}

.bias-bar.right {
  background: linear-gradient(90deg, #e74c3c, #c0392b);
}

.bias-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 60px;
}

.bias-label {
  font-size: 0.8rem;
  color: #666;
}

.bias-count {
  font-weight: 600;
  color: #333;
}

.coverage-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.coverage-metric {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-label {
  font-size: 0.9rem;
  color: #666;
  min-width: 100px;
}

.metric-bar {
  flex: 1;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.metric-fill.full {
  background: #28a745;
}

.metric-fill.partial {
  background: #ffc107;
}

.metric-fill.limited {
  background: #dc3545;
}

.metric-value {
  font-weight: 600;
  color: #333;
  min-width: 30px;
  text-align: right;
}

.analysis-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  width: 16px;
  height: 16px;
}

.status-icon.pending {
  color: #ffc107;
}

.status-icon.processing {
  color: #17a2b8;
}

.status-icon.completed {
  color: #28a745;
}

.status-label {
  flex: 1;
  font-size: 0.9rem;
  color: #666;
}

.status-count {
  font-weight: 600;
  color: #333;
}

.analysis-actions {
  border-top: 1px solid #e9ecef;
  padding-top: 12px;
}

.fa-spin {
  animation: fa-spin 2s infinite linear;
}

@keyframes fa-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.blindspots-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blindspot-item {
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: #f8f9fa;
}

.blindspot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.blindspot-type {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.blindspot-type.left_missing {
  background: #d1ecf1;
  color: #0c5460;
}

.blindspot-type.right_missing {
  background: #f8d7da;
  color: #721c24;
}

.blindspot-type.center_missing {
  background: #e2e3e5;
  color: #383d41;
}

.blindspot-severity {
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.blindspot-severity.low {
  background: #d4edda;
  color: #155724;
}

.blindspot-severity.medium {
  background: #fff3cd;
  color: #856404;
}

.blindspot-severity.high {
  background: #f8d7da;
  color: #721c24;
}

.blindspot-description {
  font-size: 0.9rem;
  color: #495057;
  margin: 6px 0 4px 0;
}

@media (max-width: 768px) {
  .dashboard-title {
    font-size: 1.8rem;
  }
  
  .dashboard-subtitle {
    font-size: 1rem;
  }
  
  .bias-item {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  
  .bias-info {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
