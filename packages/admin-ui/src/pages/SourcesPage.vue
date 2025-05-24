<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../composables/useApi'

interface Source { id: number; name: string; rss: string; bias: number }

const sources = ref<Source[]>([])
const loading = ref(true)

async function load () {
  loading.value = true
  try {
    sources.value = await api<Source[]>('/sources')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="p-6 max-w-4xl mx-auto">
    <h2 class="text-xl font-semibold mb-4">Sources</h2>

    <p v-if="loading">Loading…</p>

    <ul v-else class="divide-y divide-neutral-800">
      <li v-for="s in sources" :key="s.id" class="py-3">
        <div class="font-medium">{{ s.name }}</div>
        <div class="text-xs text-neutral-400">{{ s.rss }}</div>
      </li>
    </ul>
  </section>
</template>