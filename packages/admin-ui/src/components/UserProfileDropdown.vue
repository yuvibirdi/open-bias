<template>
  <div class="user-profile-dropdown">
    <!-- Notification Bell -->
    <div class="notification-bell" @click="toggleNotifications">
      <icon name="bell" />
      <span v-if="notificationCount > 0" class="notification-badge">
        {{ notificationCount > 99 ? '99+' : notificationCount }}
      </span>
    </div>

    <!-- User Avatar/Menu -->
    <div class="user-menu" @click="toggleDropdown">
      <div class="user-avatar">
        <span>{{ userInitials }}</span>
      </div>
      <icon name="chevron-down" :class="{ 'rotated': isDropdownOpen }" />
    </div>

    <!-- Dropdown Menu -->
    <div v-if="isDropdownOpen" class="dropdown-menu" @click.stop>
      <div class="dropdown-header">
        <div class="user-info">
          <div class="user-name">{{ user?.name }}</div>
          <div class="user-email">{{ user?.email }}</div>
        </div>
      </div>
      
      <div class="dropdown-divider"></div>
      
      <button @click="navigateToProfile" class="dropdown-item">
        <icon name="user" />
        Profile Settings
      </button>
      
      <button @click="navigateToPreferences" class="dropdown-item">
        <icon name="settings" />
        Preferences
      </button>
      
      <button @click="navigateToHistory" class="dropdown-item">
        <icon name="clock" />
        Reading History
      </button>
      
      <div class="dropdown-divider"></div>
      
      <button @click="handleLogout" class="dropdown-item logout">
        <icon name="log-out" />
        Sign Out
      </button>
    </div>

    <!-- Notifications Panel -->
    <div v-if="isNotificationsOpen" class="notifications-panel" @click.stop>
      <div class="panel-header">
        <h3>Notifications</h3>
        <button @click="markAllAsRead" class="mark-all-read">
          Mark all as read
        </button>
      </div>
      
      <div class="notifications-list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-item"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-icon">
            <icon :name="getNotificationIcon(notification.type)" />
          </div>
          <div class="notification-content">
            <div class="notification-title">
              {{ formatNotificationType(notification.type) }}
            </div>
            <div class="notification-description">
              {{ notification.description || `New ${notification.type} detected` }}
            </div>
            <div class="notification-time">
              {{ formatTimestamp(notification.createdAt) }}
            </div>
          </div>
        </div>
        
        <div v-if="notifications.length === 0" class="no-notifications">
          <icon name="check-circle" />
          <p>All caught up!</p>
        </div>
      </div>
    </div>

    <!-- Click outside overlay -->
    <div
      v-if="isDropdownOpen || isNotificationsOpen"
      class="overlay"
      @click="closeAll"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'
import { useRouter } from 'vue-router'

const { user, logout } = useAuth()
const { get } = useApi()
const router = useRouter()

const isDropdownOpen = ref(false)
const isNotificationsOpen = ref(false)
const notifications = ref([])
const notificationCount = ref(0)

const userInitials = computed(() => {
  if (!user.value?.name) return 'U'
  return user.value.name
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
  isNotificationsOpen.value = false
}

const toggleNotifications = () => {
  isNotificationsOpen.value = !isNotificationsOpen.value
  isDropdownOpen.value = false
  
  if (isNotificationsOpen.value) {
    loadNotifications()
  }
}

const closeAll = () => {
  isDropdownOpen.value = false
  isNotificationsOpen.value = false
}

const loadNotifications = async () => {
  try {
    const response = await get('/notifications/list')
    notifications.value = response.notifications
    notificationCount.value = response.unreadCount
  } catch (error) {
    console.error('Failed to load notifications:', error)
  }
}

const loadNotificationCount = async () => {
  try {
    const response = await get('/notifications/count')
    notificationCount.value = response.count
  } catch (error) {
    console.error('Failed to load notification count:', error)
  }
}

const markAllAsRead = async () => {
  // Implementation would mark all as read
  notificationCount.value = 0
  notifications.value = []
}

const handleNotificationClick = async (notification: any) => {
  try {
    await get(`/notifications/read/${notification.id}`)
    notifications.value = notifications.value.filter(n => n.id !== notification.id)
    notificationCount.value = Math.max(0, notificationCount.value - 1)
    
    // Navigate to the story/group
    router.push(`/story/${notification.groupId}`)
  } catch (error) {
    console.error('Failed to mark notification as read:', error)
  }
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'left_missing': return 'trending-left'
    case 'right_missing': return 'trending-right'
    case 'center_missing': return 'minus-circle'
    case 'underreported': return 'alert-triangle'
    default: return 'bell'
  }
}

const formatNotificationType = (type: string) => {
  switch (type) {
    case 'left_missing': return 'Missing Left Perspective'
    case 'right_missing': return 'Missing Right Perspective'
    case 'center_missing': return 'Missing Center Perspective'
    case 'underreported': return 'Underreported Story'
    default: return 'New Notification'
  }
}

const formatTimestamp = (timestamp: string | Date) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const navigateToProfile = () => {
  router.push('/profile')
  closeAll()
}

const navigateToPreferences = () => {
  router.push('/preferences')
  closeAll()
}

const navigateToHistory = () => {
  router.push('/history')
  closeAll()
}

const handleLogout = () => {
  logout()
  router.push('/')
  closeAll()
}

// Load notification count on mount and periodically
onMounted(() => {
  if (user.value) {
    loadNotificationCount()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotificationCount, 30000)
    
    onUnmounted(() => {
      clearInterval(interval)
    })
  }
})

// Close dropdowns when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.closest('.user-profile-dropdown')) {
    closeAll()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.user-profile-dropdown {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.notification-bell {
  position: relative;
  padding: 0.5rem;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.notification-bell:hover {
  background: rgba(0, 0, 0, 0.05);
}

.notification-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #ef4444;
  color: white;
  border-radius: 10px;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  min-width: 1.25rem;
  text-align: center;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.user-menu:hover {
  background: rgba(0, 0, 0, 0.05);
}

.user-avatar {
  width: 2rem;
  height: 2rem;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 0.875rem;
}

.rotated {
  transform: rotate(180deg);
}

.dropdown-menu,
.notifications-panel {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  min-width: 240px;
  z-index: 50;
  margin-top: 0.5rem;
}

.notifications-panel {
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
}

.dropdown-header {
  padding: 1rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name {
  font-weight: 500;
  color: #111827;
}

.user-email {
  font-size: 0.875rem;
  color: #6b7280;
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.5rem 0;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
  color: #374151;
}

.dropdown-item:hover {
  background: #f9fafb;
}

.dropdown-item.logout {
  color: #dc2626;
}

.dropdown-item.logout:hover {
  background: #fef2f2;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.mark-all-read {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 0.875rem;
  cursor: pointer;
}

.mark-all-read:hover {
  text-decoration: underline;
}

.notifications-list {
  max-height: 300px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.notification-item:hover {
  background: #f9fafb;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  background: #eff6ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 500;
  color: #111827;
  margin-bottom: 0.25rem;
}

.notification-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
  line-height: 1.4;
}

.notification-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.no-notifications {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: #9ca3af;
}

.no-notifications p {
  margin: 0;
  font-size: 0.875rem;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
}
</style>
