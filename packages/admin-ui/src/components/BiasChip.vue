<script setup lang="ts">
defineProps<{ bias: number }>()
</script>

<template>
  <span
    :class="[
      'px-2 py-0.5 rounded-md text-xs font-semibold',
      bias === 1
        ? 'bg-gray-800 text-white'
        : bias === 2
        ? 'bg-gray-700 text-white'
        : bias === 3
        ? 'bg-gray-600 text-white'
        : 'bg-gray-900 text-white'
    ]"
  >
    {{ label }}
  </span>
</template>

<script lang="ts">
export default {
  computed: {
    label(): string {
      return this.bias === 1
        ? 'Left'
        : this.bias === 2
        ? 'Center'
        : this.bias === 3
        ? 'Right'
        : 'Unknown'
    }
  }
}
</script>