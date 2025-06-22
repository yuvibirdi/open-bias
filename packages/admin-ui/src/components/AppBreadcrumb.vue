<template>
  <CBreadcrumb class="d-md-down-none me-auto mb-0">
    <CBreadcrumbItem
      v-for="item in breadcrumbs"
      :key="item.name"
      :href="item.active ? '' : item.path"
      :active="item.active"
    >
      {{ item.name }}
    </CBreadcrumbItem>
  </CBreadcrumb>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const breadcrumbs = ref([])

onMounted(() => {
  breadcrumbs.value = getBreadcrumbs(router.currentRoute.value.matched)
})

const getBreadcrumbs = (matched) => {
  return matched.map((route) => {
    return {
      active: route.path === router.currentRoute.value.fullPath,
      name: route.name || route.path,
      path: route.path,
    }
  })
}

router.afterEach((to) => {
  breadcrumbs.value = getBreadcrumbs(to.matched)
})
</script>
