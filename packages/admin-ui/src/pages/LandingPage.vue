<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { api } from '../composables/useApi';
import BiasChip from '../components/BiasChip.vue'; // We might replace or restyle this later

interface Article {
  id: string; // Elasticsearch ID is string
  title: string;
  summary: string;
  imageUrl: string;
  bias: number;
  link: string;
  published?: string;
  // TODO: Add source name, e.g., from a 'sourceName' field if API provides it
  sourceName?: string; 
}

const articles = ref<Article[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

// Fetch more articles to have a better selection for the layout
onMounted(async () => {
  try {
    loading.value = true;
    error.value = null;
    const response = await api<{ articles: Article[] }>('/articles?limit=10'); // Fetch 10 articles
    articles.value = response.articles.map(article => ({
      ...article,
      // Placeholder for sourceName - ideally this comes from the API based on sourceId
      sourceName: article.sourceName || 'News Outlet' // Replace with actual source name if available
    }));
  } catch (e: any) {
    error.value = e.message || 'Failed to load articles.';
    console.error(e);
  } finally {
    loading.value = false;
  }
});

const featuredArticle = computed(() => articles.value.length > 0 ? articles.value[0] : null);
const topStories = computed(() => articles.value.slice(1, 5)); // Next 4 articles for top stories list
const remainingArticles = computed(() => articles.value.slice(5)); // Rest for a grid/list

// Placeholder data for the Blindspot section
const blindspotData = ref({
  title: 'The Daily Briefing',
  storyCount: 9,
  readingTime: '9m read',
  mainImage: 'https://via.placeholder.com/600x400?text=Daily+Briefing+Image',
  items: [
    { title: 'Bird Flu in Mammals Doubles, Raising Pandemic Concerns', image: 'https://via.placeholder.com/100x70?text=Bird+Flu' },
    { title: 'Crypto Investor Arrested for Alleged Kidnapping and Torture', image: 'https://via.placeholder.com/100x70?text=Crypto+Arrest' },
    { title: 'Database reveals 184 million credentials; Germany establishes NATO eastern troops', image: 'https://via.placeholder.com/100x70?text=Data+Leak' },
  ]
});

</script>

<template>
  <div class="bg-gray-100 min-h-screen">
    <!-- Main Content Area -->
    <main class="container mx-auto py-8 px-4">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Column: Daily Briefing / Blindspot -->
        <div class="lg:col-span-1 space-y-6">
          <section class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">{{ blindspotData.title }}</h2>
            <div class="text-sm text-gray-500 mb-1">{{ blindspotData.storyCount }} stories</div>
            <div class="text-sm text-gray-500 mb-4">{{ blindspotData.readingTime }}</div>
            <img :src="blindspotData.mainImage" alt="Daily Briefing" class="w-full h-auto rounded-md mb-4">
            <ul class="space-y-3">
              <li v-for="(item, index) in blindspotData.items" :key="index" class="flex items-center space-x-3">
                <img :src="item.image" :alt="item.title" class="w-20 h-16 object-cover rounded-md">
                <a href="#" class="text-sm text-gray-700 hover:text-blue-600 hover:underline">{{ item.title }}</a>
              </li>
            </ul>
            <a href="#" class="mt-4 inline-block text-sm text-blue-600 hover:underline">See all stories &rarr;</a>
          </section>
          
          <!-- Placeholder for other left-column content like "Top News Stories" list -->
        </div>

        <!-- Center Column: Main Featured Article -->
        <div class="lg:col-span-2">
          <section v-if="loading" class="text-center py-10">
            <p class="text-gray-600">Loading featured article...</p>
            <!-- Basic spinner -->
            <div class="mt-4 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </section>
          <section v-if="error" class="bg-red-100 p-6 rounded-lg shadow">
            <h3 class="text-red-700 font-semibold">Failed to load articles</h3>
            <p class="text-red-600">{{ error }}</p>
          </section>

          <section v-if="!loading && !error && featuredArticle" class="bg-white rounded-lg shadow overflow-hidden">
            <a :href="featuredArticle.link" target="_blank">
              <img :src="featuredArticle.imageUrl" :alt="featuredArticle.title" class="w-full h-72 object-cover">
            </a>
            <div class="p-6">
              <div class="mb-2">
                <span class="text-xs font-semibold text-gray-500 uppercase">{{ featuredArticle.sourceName }}</span> 
                <span v-if="featuredArticle.published" class="text-xs text-gray-400"> &bull; {{ new Date(featuredArticle.published).toLocaleDateString() }}</span>
              </div>
              <h2 class="text-3xl font-bold text-gray-800 mb-3">
                <a :href="featuredArticle.link" target="_blank" class="hover:text-blue-700 transition-colors">{{ featuredArticle.title }}</a>
              </h2>
              <p class="text-gray-600 mb-4 leading-relaxed line-clamp-3">{{ featuredArticle.summary }}</p>
              
              <!-- Bias Display - Ground News Style (Simplified) -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-1 text-sm">
                  <span :class="['px-3 py-1 rounded-full text-xs font-semibold', featuredArticle.bias === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700']">L</span>
                  <span :class="['px-3 py-1 rounded-full text-xs font-semibold', featuredArticle.bias === 2 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700']">C</span>
                  <span :class="['px-3 py-1 rounded-full text-xs font-semibold', featuredArticle.bias === 3 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700']">R</span>
                  <span v-if="featuredArticle.bias === 0" class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-400 text-white">N/A</span>
                </div>
                <a :href="featuredArticle.link" target="_blank" class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                  Read Full Story &rarr;
                </a>
              </div>
            </div>
          </section>
          
          <!-- Grid for remaining articles -->
          <section v-if="!loading && !error && remainingArticles.length > 0" class="mt-8">
            <h3 class="text-2xl font-semibold text-gray-800 mb-6">More Stories</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div v-for="article in remainingArticles" :key="article.id" class="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <a :href="article.link" target="_blank">
                    <img :src="article.imageUrl" :alt="article.title" class="w-full h-48 object-cover">
                </a>
                <div class="p-5 flex flex-col flex-grow">
                  <div>
                    <span class="text-xs font-semibold text-gray-500 uppercase">{{ article.sourceName }}</span> 
                    <span v-if="article.published" class="text-xs text-gray-400"> &bull; {{ new Date(article.published).toLocaleDateString() }}</span>
                  </div>
                  <h4 class="text-lg font-semibold text-gray-800 mt-1 mb-2">
                    <a :href="article.link" target="_blank" class="hover:text-blue-700 transition-colors line-clamp-2">{{ article.title }}</a>
                  </h4>
                  <p class="text-sm text-gray-600 mb-3 flex-grow line-clamp-3">{{ article.summary }}</p>
                  <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-200">
                    <div class="flex items-center space-x-1 text-sm">
                      <span :class="['px-2 py-0.5 rounded-full text-xs font-semibold', article.bias === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600']">L</span>
                      <span :class="['px-2 py-0.5 rounded-full text-xs font-semibold', article.bias === 2 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600']">C</span>
                      <span :class="['px-2 py-0.5 rounded-full text-xs font-semibold', article.bias === 3 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600']">R</span>
                       <span v-if="article.bias === 0" class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-400 text-white">N/A</span>
                    </div>
                    <a :href="article.link" target="_blank" class="text-xs font-medium text-blue-600 hover:underline">Details</a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Right Column: (Placeholder for ads or other content like Ground News) -->
        <div class="lg:col-span-1 space-y-6 hidden lg:block">
          <div class="bg-white p-6 rounded-lg shadow h-96 flex items-center justify-center text-gray-400">
            Content / Ad Space Placeholder
          </div>
        </div>
      </div>
    </main>

    <footer class="py-8 mt-auto border-t border-gray-200 bg-white">
      <div class="container mx-auto px-4 text-center text-sm text-gray-500">
        <p>&copy; {{ new Date().getFullYear() }} Open Bias. All rights reserved.</p>
        <p class="mt-1">Dedicated to fostering a more informed public.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.container {
  max-width: 1400px; /* Wider container for a news site feel */
}

/* Line clamp utility (Tailwind might have this built-in in newer versions or via plugin) */
.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.line-clamp-3 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
</style> 