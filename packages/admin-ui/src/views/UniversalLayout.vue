<template>
  <div class="app-layout">
    <!-- Navigation Bar for Both Admin and Normal Users -->
    <nav class="top-navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <router-link to="/" class="brand-link">
            <h2>OpenBias</h2>
          </router-link>
        </div>

        <div class="nav-menu">
          <!-- Regular User Navigation -->
          <template v-if="!isAdminUser">
            <router-link to="/stories" class="nav-link">Stories</router-link>
            <router-link to="/sources" class="nav-link">Sources</router-link>
          </template>

          <!-- Admin Navigation -->
          <template v-if="isAdminUser">
            <router-link to="/dashboard" class="nav-link">Dashboard</router-link>
            <router-link to="/articles" class="nav-link">Articles</router-link>
            <router-link to="/sources" class="nav-link">Sources</router-link>
            <router-link to="/stories" class="nav-link">Stories</router-link>
          </template>

          <!-- User Profile/Auth -->
          <div class="user-section">
            <template v-if="isAuthenticated">
              <UserProfileDropdown />
            </template>
            <template v-else>
              <button @click="showAuthModal = true" class="auth-button">
                Sign In
              </button>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- Auth Modal for Non-authenticated Users -->
    <AuthModal 
      v-if="showAuthModal" 
      @close="showAuthModal = false"
      @authenticated="handleAuthentication"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import UserProfileDropdown from '@/components/UserProfileDropdown.vue'
import AuthModal from '@/components/AuthModal.vue'

const { isAuthenticated, user, loadUser } = useAuth()
const showAuthModal = ref(false)

const isAdminUser = computed(() => {
  return user.value?.role === 'admin' || user.value?.role === 'moderator'
})

const handleAuthentication = () => {
  showAuthModal.value = false
  loadUser() // Refresh user data
}

onMounted(() => {
  // Load user data if authenticated
  if (isAuthenticated.value) {
    loadUser()
  }
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-navbar {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.nav-brand .brand-link {
  text-decoration: none;
  color: #1f2937;
}

.nav-brand h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-link {
  text-decoration: none;
  color: #6b7280;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: #3b82f6;
  background: #f3f4f6;
}

.nav-link.router-link-active {
  color: #3b82f6;
  background: #eff6ff;
}

.user-section {
  display: flex;
  align-items: center;
}

.auth-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.auth-button:hover {
  background: #2563eb;
}

.main-content {
  flex: 1;
  background: #f9fafb;
}

@media (max-width: 768px) {
  .nav-container {
    padding: 0 0.5rem;
  }
  
  .nav-menu {
    gap: 1rem;
  }
  
  .nav-link {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }
}
</style>
