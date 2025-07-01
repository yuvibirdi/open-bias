<template>
  <div class="history-page">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900">Reading History</h1>
      <button 
        @click="clearHistory"
        class="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
      >
        Clear History
      </button>
    </div>

    <!-- Filters -->
    <div class="mb-6 flex flex-wrap gap-4">
      <select 
        v-model="selectedTimeframe" 
        class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="all">All Time</option>
        <option value="week">Last Week</option>
        <option value="month">Last Month</option>
        <option value="year">Last Year</option>
      </select>

      <select 
        v-model="selectedCategory" 
        class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">All Categories</option>
        <option value="politics">Politics</option>
        <option value="business">Business</option>
        <option value="technology">Technology</option>
        <option value="sports">Sports</option>
        <option value="entertainment">Entertainment</option>
      </select>
    </div>

    <!-- History List -->
    <div v-if="loading" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
      <p class="mt-2 text-gray-600">Loading your reading history...</p>
    </div>

    <div v-else-if="filteredHistory.length === 0" class="text-center py-12">
      <div class="text-gray-400 mb-4">
        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No Reading History</h3>
      <p class="text-gray-600">Start reading stories to build your history.</p>
    </div>

    <div v-else class="space-y-4">
      <div 
        v-for="item in paginatedHistory" 
        :key="item.id"
        class="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
        @click="viewStory(item.story)"
      >
        <div class="flex justify-between items-start mb-3">
          <h3 class="text-lg font-semibold text-gray-900 flex-1 mr-4">
            {{ item.story.title }}
          </h3>
          <span class="text-sm text-gray-500 whitespace-nowrap">
            {{ formatDate(item.readAt) }}
          </span>
        </div>

        <p class="text-gray-600 text-sm mb-3 line-clamp-2">
          {{ item.story.summary }}
        </p>

        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <span class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
              {{ item.story.category }}
            </span>
            <span class="text-xs text-gray-500">
              {{ item.story.sources?.length || 0 }} sources
            </span>
            <div v-if="item.story.biasScore" class="flex items-center space-x-1">
              <span class="text-xs text-gray-500">Bias:</span>
              <div class="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all duration-300"
                  :class="getBiasColor(item.story.biasScore)"
                  :style="{ width: `${Math.abs(item.story.biasScore) * 10}%` }"
                ></div>
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <button 
              @click.stop="removeFromHistory(item.id)"
              class="text-gray-400 hover:text-red-500 transition-colors"
              title="Remove from history"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="mt-8 flex justify-center">
      <nav class="flex space-x-2">
        <button
          v-for="page in totalPages"
          :key="page"
          @click="currentPage = page"
          class="px-3 py-2 text-sm rounded-lg transition-colors"
          :class="page === currentPage 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        >
          {{ page }}
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

interface Story {
  id: string
  title: string
  summary: string
  category: string
  biasScore?: number
  sources?: any[]
}

interface HistoryItem {
  id: string
  story: Story
  readAt: string
}

const router = useRouter()
const { api } = useApi()

const loading = ref(true)
const history = ref<HistoryItem[]>([])
const selectedTimeframe = ref('all')
const selectedCategory = ref('')
const currentPage = ref(1)
const itemsPerPage = 10

// Mock data for development
const mockHistory: HistoryItem[] = [
  {
    id: '1',
    story: {
      id: 'story1',
      title: 'Breaking: Major Political Development Unfolds',
      summary: 'A significant political event has captured national attention with various news outlets providing different perspectives on the implications.',
      category: 'politics',
      biasScore: 3.2,
      sources: [{}, {}, {}]
    },
    readAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  },
  {
    id: '2',
    story: {
      id: 'story2',
      title: 'Tech Innovation Reshapes Industry Standards',
      summary: 'Revolutionary technology advancement promises to transform how businesses operate in the digital age.',
      category: 'technology',
      biasScore: -1.5,
      sources: [{}, {}]
    },
    readAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
  },
  {
    id: '3',
    story: {
      id: 'story3',
      title: 'Economic Markets Show Unprecedented Volatility',
      summary: 'Financial experts analyze recent market movements and their potential impact on global economy.',
      category: 'business',
      biasScore: 0.8,
      sources: [{}, {}, {}, {}]
    },
    readAt: new Date(Date.now() - 259200000).toISOString() // 3 days ago
  }
]

const filteredHistory = computed(() => {
  let filtered = history.value

  // Filter by timeframe
  if (selectedTimeframe.value !== 'all') {
    const now = new Date()
    const cutoff = new Date()
    
    switch (selectedTimeframe.value) {
      case 'week':
        cutoff.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoff.setMonth(now.getMonth() - 1)
        break
      case 'year':
        cutoff.setFullYear(now.getFullYear() - 1)
        break
    }
    
    filtered = filtered.filter(item => new Date(item.readAt) >= cutoff)
  }

  // Filter by category
  if (selectedCategory.value) {
    filtered = filtered.filter(item => item.story.category === selectedCategory.value)
  }

  return filtered.sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime())
})

const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredHistory.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredHistory.value.length / itemsPerPage)
})

const loadHistory = async () => {
  try {
    loading.value = true
    // In a real app, this would call the API
    // const response = await api.get('/user/history')
    // history.value = response.data
    
    // For now, use mock data
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate loading
    history.value = mockHistory
  } catch (error) {
    console.error('Failed to load reading history:', error)
  } finally {
    loading.value = false
  }
}

const clearHistory = async () => {
  if (confirm('Are you sure you want to clear your entire reading history? This action cannot be undone.')) {
    try {
      // await api.delete('/user/history')
      history.value = []
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }
}

const removeFromHistory = async (itemId: string) => {
  try {
    // await api.delete(`/user/history/${itemId}`)
    history.value = history.value.filter(item => item.id !== itemId)
  } catch (error) {
    console.error('Failed to remove item from history:', error)
  }
}

const viewStory = (story: Story) => {
  router.push(`/story/${story.id}`)
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`
  return `${Math.ceil(diffDays / 365)} years ago`
}

const getBiasColor = (score: number) => {
  if (score > 2) return 'bg-red-500'
  if (score > 0) return 'bg-red-300'
  if (score < -2) return 'bg-blue-500'
  if (score < 0) return 'bg-blue-300'
  return 'bg-green-500'
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
