<template>
  <CContainer fluid>
    <CRow>
      <CCol :xs="12">
        <CCard class="mb-4">
          <CCardHeader>
            <strong>OpenBias Dashboard</strong>
          </CCardHeader>
          <CCardBody>
            <p>Welcome to the OpenBias Admin Dashboard!</p>
            <CRow>
              <CCol sm="6" lg="3">
                <CWidgetStatsA class="mb-4" color="primary">
                  <template #value>
                    {{ stats.totalArticles }}
                  </template>
                  <template #title>Total Articles</template>
                </CWidgetStatsA>
              </CCol>
              <CCol sm="6" lg="3">
                <CWidgetStatsA class="mb-4" color="info">
                  <template #value>
                    {{ stats.totalSources }}
                  </template>
                  <template #title>Total Sources</template>
                </CWidgetStatsA>
              </CCol>
              <CCol sm="6" lg="3">
                <CWidgetStatsA class="mb-4" color="warning">
                  <template #value>
                    {{ stats.leftBias }}
                  </template>
                  <template #title>Left Bias</template>
                </CWidgetStatsA>
              </CCol>
              <CCol sm="6" lg="3">
                <CWidgetStatsA class="mb-4" color="danger">
                  <template #value>
                    {{ stats.rightBias }}
                  </template>
                  <template #title>Right Bias</template>
                </CWidgetStatsA>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </CContainer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const stats = ref({
  totalArticles: 0,
  totalSources: 0,
  leftBias: 0,
  rightBias: 0,
})

onMounted(async () => {
  // Mock data for now
  stats.value = {
    totalArticles: 1250,
    totalSources: 45,
    leftBias: 320,
    rightBias: 280,
  }
})
</script>
<<<<<<< Updated upstream
=======

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
>>>>>>> Stashed changes
