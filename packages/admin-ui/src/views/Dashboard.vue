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
