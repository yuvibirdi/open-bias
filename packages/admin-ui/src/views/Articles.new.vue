<template>
  <CContainer fluid>
    <CRow>
      <CCol :xs="12">
        <CCard class="mb-4">
          <CCardHeader>
            <strong>Articles Management</strong>
          </CCardHeader>
          <CCardBody>
            <p>Manage articles from all sources</p>
            
            <!-- Error message -->
            <div v-if="error" class="alert alert-warning">
              {{ error }}
            </div>
            
            <!-- Articles Table -->
            <CTable hover responsive v-if="!loading">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Title</CTableHeaderCell>
                  <CTableHeaderCell>Source</CTableHeaderCell>
                  <CTableHeaderCell>Bias</CTableHeaderCell>
                  <CTableHeaderCell>Published</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="article in articles" :key="article.id">
                  <CTableDataCell>
                    <a :href="article.link" target="_blank" class="text-decoration-none">
                      {{ article.title }}
                    </a>
                  </CTableDataCell>
                  <CTableDataCell>{{ article.sourceName || 'Unknown' }}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="getBiasColor(article.bias)">
                      {{ getBiasLabel(article.bias) }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>{{ formatDate(article.published) }}</CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>

            <!-- Loading state -->
            <div v-if="loading" class="text-center p-4">
              <CSpinner />
              <p class="mt-2">Loading articles...</p>
            </div>
            
            <!-- Empty state -->
            <div v-else-if="articles.length === 0" class="text-center p-4">
              <p>No articles found.</p>
              <CButton color="primary" @click="loadArticles">Retry</CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  </CContainer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getArticles } from '../composables/useApi'
import type { Article } from '../composables/useApi'

const articles = ref<Article[]>([])
const loading = ref(false)
const error = ref('')

const getBiasColor = (bias: number): string => {
  switch (bias) {
    case 1: return 'primary'
    case 2: return 'success'
    case 3: return 'danger'
    default: return 'secondary'
  }
}

const getBiasLabel = (bias: number): string => {
  switch (bias) {
    case 1: return 'Left'
    case 2: return 'Center'
    case 3: return 'Right'
    default: return 'Unknown'
  }
}

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return 'Invalid Date'
  }
}

const loadArticles = async () => {
  loading.value = true
  error.value = ''
  
  try {
    console.log('Attempting to load articles from API...')
    const response = await getArticles({ limit: 50 })
    
    if (response && response.articles) {
      articles.value = response.articles
      console.log('Successfully loaded articles:', articles.value.length)
    } else {
      throw new Error('Invalid API response format')
    }
  } catch (err) {
    console.error('Failed to load articles from API:', err)
    error.value = 'Unable to load articles from database. Using sample data.'
    
    // Fallback to mock data when API fails
    articles.value = [
      {
        id: 1,
        title: "Sample Article 1 - API Connection Failed",
        link: "https://example.com/article1",
        summary: "This is sample data because the API is not responding...",
        bias: 1,
        published: "2024-01-15T10:30:00Z",
        sourceName: "Sample News"
      },
      {
        id: 2,
        title: "Sample Article 2 - Check Elasticsearch Connection", 
        link: "https://example.com/article2",
        summary: "The backend API is having trouble connecting to Elasticsearch...",
        bias: 2,
        published: "2024-01-14T09:15:00Z",
        sourceName: "Another News"
      },
      {
        id: 3,
        title: "Sample Article 3 - Database Connection Issue",
        link: "https://example.com/article3", 
        summary: "Make sure Elasticsearch is running and accessible...",
        bias: 3,
        published: "2024-01-13T08:20:00Z",
        sourceName: "Tech News"
      }
    ]
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadArticles()
})
</script>
