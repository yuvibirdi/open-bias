<template>
  <CSidebar
    class="d-print-none sidebar sidebar-fixed"
    :minimize="uiStore.sidebarMinimize"
    :show="uiStore.sidebarShow"
    @visible-change="uiStore.setSidebar"
  >
    <CSidebarBrand :router-link="{ name: 'Dashboard' }">
      <CIcon
        :icon="logoNegative"
        :height="35"
        alt="CoreUI Logo"
      />
    </CSidebarBrand>
    <CSidebarNav
      :nav="nav"
    />
    <CSidebarToggler
      class="d-none d-lg-flex"
      @click="uiStore.toggleSidebarMinimize"
    />
  </CSidebar>
</template>

<script setup>
import { useUIStore } from '@/stores'
import nav from '@/_nav'

const logoNegative = ['cib-creative-commons', 'cib-cc-by']
const uiStore = useUIStore()
</script>
