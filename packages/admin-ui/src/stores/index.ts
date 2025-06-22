import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', {
  state: () => ({
    sidebarShow: true,
    sidebarMinimize: false,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarShow = !this.sidebarShow
    },
    setSidebar(value: boolean) {
      this.sidebarShow = value
    },
    toggleSidebarMinimize() {
      this.sidebarMinimize = !this.sidebarMinimize
    },
  },
})
