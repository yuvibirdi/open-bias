<template>
  <div class="enhanced-image-container" :class="containerClass">
    <!-- Loading state -->
    <div v-if="loading" class="image-loading" :class="loadingClass">
      <div class="loading-spinner"></div>
    </div>
    
    <!-- Image with fallbacks -->
    <img 
      v-show="!loading && !error && currentImageSrc"
      :src="currentImageSrc"
      :alt="alt"
      :class="imageClass"
      @load="handleLoad"
      @error="handleError"
      :loading="lazy ? 'lazy' : 'eager'"
    />
    
    <!-- Placeholder when no image or all failed -->
    <div v-if="!loading && (error || !currentImageSrc)" class="image-placeholder" :class="placeholderClass">
      <slot name="placeholder" :error="error">
        <div class="default-placeholder">
          <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 011 1.732l4 4A2 2 0 0120 11v7a2 2 0 01-2 2z">
            </path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
                  d="M16 3.5v5a2 2 0 002 2h5">
            </path>
          </svg>
          <span class="placeholder-text">{{ placeholderText }}</span>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  src: {
    type: [String, Array],
    default: null
  },
  fallbacks: {
    type: Array,
    default: () => []
  },
  alt: {
    type: String,
    default: 'Image'
  },
  containerClass: {
    type: String,
    default: ''
  },
  imageClass: {
    type: String,
    default: ''
  },
  loadingClass: {
    type: String,
    default: ''
  },
  placeholderClass: {
    type: String,
    default: ''
  },
  placeholderText: {
    type: String,
    default: 'No Image'
  },
  category: {
    type: String,
    default: 'news'
  },
  lazy: {
    type: Boolean,
    default: true
  },
  enablePlaceholder: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['load', 'error'])

const loading = ref(true)
const error = ref(false)
const currentIndex = ref(0)

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

// Hash function for consistent random images
const hashString = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Create array of all possible image sources
const allImageSources = computed(() => {
const sources = []
  
  // Add primary source(s)
  if (Array.isArray(props.src)) {
    sources.push(...props.src.filter(isValidImageUrl))
  } else if (isValidImageUrl(props.src)) {
    sources.push(props.src)
  }
  
  // Add fallback sources
  sources.push(...props.fallbacks.filter(isValidImageUrl))
  
  // Add placeholder sources for testing (can be disabled in production)
  if (sources.length === 0) {
    // Generate contextual placeholders based on alt text
    const category = props.category || 'news'
    const encodedAlt = encodeURIComponent(props.alt.substring(0, 50))
    
    // Category-specific colors
    const categoryColors = {
      politics: { bg: '2563eb', text: 'ffffff' },
      business: { bg: '059669', text: 'ffffff' },
      technology: { bg: '7c3aed', text: 'ffffff' },
      sports: { bg: 'dc2626', text: 'ffffff' },
      entertainment: { bg: 'ea580c', text: 'ffffff' },
      health: { bg: '0891b2', text: 'ffffff' },
      science: { bg: '4338ca', text: 'ffffff' },
      news: { bg: '64748b', text: 'ffffff' }
    }
    
    const colors = categoryColors[category.toLowerCase()] || categoryColors.news
    
    sources.push(
      `https://via.placeholder.com/800x450/${colors.bg}/${colors.text}?text=${encodedAlt}`,
      `https://dummyimage.com/800x450/${colors.bg}/${colors.text}&text=${encodedAlt}`,
      `https://picsum.photos/800/450?random=${Math.abs(hashString(props.alt))}`
    )
  }
  
  return sources
})

const currentImageSrc = computed(() => {
  return allImageSources.value[currentIndex.value] || null
})

const handleLoad = () => {
  loading.value = false
  error.value = false
  emit('load')
}

const handleError = () => {
  console.warn(`Image failed to load: ${currentImageSrc.value}`)
  
  // Try next image source
  if (currentIndex.value < allImageSources.value.length - 1) {
    currentIndex.value++
    loading.value = true
    return
  }
  
  // No more sources available
  loading.value = false
  error.value = true
  emit('error', currentImageSrc.value)
}

const reset = () => {
  loading.value = true
  error.value = false
  currentIndex.value = 0
}

// Watch for src changes
watch(() => props.src, () => {
  reset()
}, { immediate: true })

// Watch for fallback changes
watch(() => props.fallbacks, () => {
  if (error.value && props.fallbacks.length > 0) {
    reset()
  }
})

defineExpose({
  reset,
  retry: () => {
    if (error.value) {
      reset()
    }
  }
})
</script>

<style scoped>
.enhanced-image-container {
  position: relative;
  overflow: hidden;
}

.image-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  background: #f8fafc;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  color: #64748b;
}

.default-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
}

.placeholder-icon {
  width: 32px;
  height: 32px;
  opacity: 0.6;
}

.placeholder-text {
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0.8;
}
</style>
