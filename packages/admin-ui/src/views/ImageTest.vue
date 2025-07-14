<template>
  <div class="image-test-page">
    <h1>Image Enhancement Test</h1>
    
    <!-- Test with working image -->
    <div class="test-section">
      <h2>Working Image</h2>
      <EnhancedImage
        src="https://picsum.photos/400/300"
        alt="Test Working Image"
        category="technology"
        container-class="border rounded-lg"
        image-class="w-full h-auto"
        placeholder-class="h-40"
      />
    </div>
    
    <!-- Test with broken image -->
    <div class="test-section">
      <h2>Broken Image (should show fallback)</h2>
      <EnhancedImage
        src="https://broken-image-url.com/doesnt-exist.jpg"
        alt="Test Broken Image"
        category="politics"
        container-class="border rounded-lg"
        image-class="w-full h-auto"
        placeholder-class="h-40"
      />
    </div>
    
    <!-- Test with no image (should show generated placeholder) -->
    <div class="test-section">
      <h2>No Image (should show generated placeholder)</h2>
      <EnhancedImage
        :src="null"
        alt="News Article About Technology Innovation"
        category="business"
        container-class="border rounded-lg"
        image-class="w-full h-auto"
        placeholder-class="h-40"
      />
    </div>
    
    <!-- Test with fallbacks -->
    <div class="test-section">
      <h2>Image with Fallbacks</h2>
      <EnhancedImage
        src="https://broken-image-url.com/doesnt-exist.jpg"
        :fallbacks="[
          'https://also-broken.com/image.jpg',
          'https://picsum.photos/400/300?random=1'
        ]"
        alt="Test Image with Fallbacks"
        category="sports"
        container-class="border rounded-lg"
        image-class="w-full h-auto"
        placeholder-class="h-40"
      />
    </div>
  </div>
</template>

<script setup>
import EnhancedImage from '../components/EnhancedImage.vue'
</script>

<style scoped>
.image-test-page {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.test-section {
  margin-bottom: 3rem;
}

.test-section h2 {
  margin-bottom: 1rem;
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
