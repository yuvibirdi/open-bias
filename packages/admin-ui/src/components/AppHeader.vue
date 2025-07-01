<template>
  <CHeader position="sticky" class="mb-4">
    <CContainer fluid>
      <CHeaderToggler class="ps-1" @click="uiStore.toggleSidebar">
        <CIcon icon="cil-menu" size="lg" />
      </CHeaderToggler>
      <CHeaderBrand class="mx-auto d-lg-none" to="/">
        <CIcon icon="cib-creative-commons" height="48" alt="Logo" />
      </CHeaderBrand>
      <CHeaderNav class="d-none d-md-flex me-auto">
        <CNavItem>
          <CNavLink to="/dashboard"> Dashboard </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink to="/stories"> Stories </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink to="/sources"> Sources </CNavLink>
        </CNavItem>
      </CHeaderNav>
      <CHeaderNav>
        <!-- Show login button if not authenticated -->
        <template v-if="!isAuthenticated">
          <CNavItem>
            <CButton @click="showAuthModal = true" color="primary" variant="outline">
              Sign In
            </CButton>
          </CNavItem>
        </template>
        
        <!-- Show user profile if authenticated -->
        <template v-else>
          <UserProfileDropdown />
        </template>
      </CHeaderNav>
    </CContainer>
    <CHeaderDivider />
    <CContainer fluid>
      <AppBreadcrumb />
    </CContainer>

    <!-- Auth Modal -->
    <AuthModal v-if="showAuthModal" @close="showAuthModal = false" />
  </CHeader>
</template>

<script setup>
import { ref } from 'vue'
import AppBreadcrumb from './AppBreadcrumb.vue'
import UserProfileDropdown from './UserProfileDropdown.vue'
import AuthModal from './AuthModal.vue'
import { useAuth } from '@/composables/useAuth'
import { useUIStore } from '@/stores'

const { isAuthenticated } = useAuth()
const uiStore = useUIStore()
const showAuthModal = ref(false)
</script>
