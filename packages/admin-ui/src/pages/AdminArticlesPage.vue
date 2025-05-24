<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'
import BiasChip from '../components/BiasChip.vue'

interface Article {
  id?: number
  title: string
  link: string
  published: string
  bias: number
}

const articles = ref<Article[]>([])
const loading  = ref(true)
const page     = ref(1)
const perPage  = 20

async function load () {
  loading.value = true
  try {
    const data = await api<{ articles: Article[] }>(`/articles?limit=${perPage}&page=${page.value}`)
    articles.value = data.articles
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="p-6 max-w-7xl mx-auto">
    <h2 class="text-xl font-semibold mb-4">Articles</h2>

    <p v-if="loading">Loading…</p>

    <table v-else class="w-full text-sm border-collapse">
      <thead class="text-neutral-400 text-left">
        <tr class="border-b border-neutral-700">
          <th class="py-2">Title</th>
          <th>Published</th>
          <th>Bias</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in articles" :key="a.link" class="border-b border-neutral-800 hover:bg-neutral-800/50">
          <td class="py-2">
            <a :href="a.link" target="_blank" class="hover:underline">{{ a.title }}</a>
          </td>
          <td>{{ new Date(a.published).toLocaleString() }}</td>
          <td><BiasChip :bias="a.bias" /></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>