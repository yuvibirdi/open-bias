<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref } from 'vue'

const mobileMenuOpen = ref(false)
</script>

<template>
  <header class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo/Site Title -->
        <RouterLink to="/" class="flex items-center">
          <span class="text-2xl font-bold text-gray-800 hover:text-blue-600 transition-colors">Open Bias</span>
        </RouterLink>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center space-x-1">
          <RouterLink 
            to="/"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            active-class="bg-gray-100 text-blue-600 font-semibold"
          >Home</RouterLink>
          <RouterLink 
            to="/explore"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            active-class="bg-gray-100 text-blue-600 font-semibold"
          >Explore</RouterLink>
          <RouterLink 
            to="/blindspot"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            active-class="bg-gray-100 text-blue-600 font-semibold"
          >Your Blindspot</RouterLink>
          <RouterLink 
            to="/admin/articles"
            class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            active-class="bg-gray-100 text-blue-600 font-semibold"
          >Admin</RouterLink>
        </nav>

        <!-- Right side: Search (placeholder) & Mobile Menu Button -->
        <div class="flex items-center space-x-3">
          <button aria-label="Search" class="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors hidden md:block">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <!-- Mobile Menu Button -->
          <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors">
            <span class="sr-only">Open menu</span>
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div v-if="mobileMenuOpen" class="md:hidden border-t border-gray-200 bg-white shadow-lg">
      <nav class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
        <RouterLink to="/" @click="mobileMenuOpen = false" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900" active-class="bg-blue-50 text-blue-600 font-semibold">Home</RouterLink>
        <RouterLink to="/explore" @click="mobileMenuOpen = false" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900" active-class="bg-blue-50 text-blue-600 font-semibold">Explore</RouterLink>
        <RouterLink to="/blindspot" @click="mobileMenuOpen = false" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900" active-class="bg-blue-50 text-blue-600 font-semibold">Your Blindspot</RouterLink>
        <RouterLink to="/admin/articles" @click="mobileMenuOpen = false" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900" active-class="bg-blue-50 text-blue-600 font-semibold">Admin</RouterLink>
        <!-- Mobile Search (optional) -->
        <div class="px-3 pt-3 pb-2">
          <label for="search-mobile" class="sr-only">Search</label>
          <input type="text" id="search-mobile" placeholder="Search..." class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm">
        </div>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.container {
  max-width: 1280px; /* Or your preferred max width like Ground News */
}
</style>