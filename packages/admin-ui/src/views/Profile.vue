<template>
  <div class="profile-view">
    <div class="profile-header">
      <h1>User Profile</h1>
      <p>Manage your account settings and preferences</p>
    </div>

    <div class="profile-content">
      <div class="profile-card">
        <h2>Account Information</h2>
        
        <form @submit.prevent="updateProfile" class="profile-form">
          <div class="form-group">
            <label for="name">Full Name</label>
            <input
              id="name"
              v-model="profile.name"
              type="text"
              class="form-input"
              required
            />
          </div>

          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              v-model="profile.email"
              type="email"
              class="form-input"
              required
            />
          </div>

          <div class="form-group">
            <label for="role">Account Type</label>
            <input
              id="role"
              v-model="profile.role"
              type="text"
              class="form-input"
              readonly
            />
          </div>

          <div class="form-actions">
            <button type="submit" :disabled="loading" class="primary-button">
              {{ loading ? 'Saving...' : 'Update Profile' }}
            </button>
          </div>
        </form>
      </div>

      <div class="profile-card">
        <h2>Account Statistics</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ stats.articlesRated }}</div>
            <div class="stat-label">Articles Rated</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ stats.blindspotsFound }}</div>
            <div class="stat-label">Blindspots Found</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ stats.daysActive }}</div>
            <div class="stat-label">Days Active</div>
          </div>
        </div>
      </div>

      <div class="profile-card">
        <h2>Change Password</h2>
        
        <form @submit.prevent="changePassword" class="password-form">
          <div class="form-group">
            <label for="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              v-model="passwordForm.current"
              type="password"
              class="form-input"
              required
            />
          </div>

          <div class="form-group">
            <label for="newPassword">New Password</label>
            <input
              id="newPassword"
              v-model="passwordForm.new"
              type="password"
              class="form-input"
              required
              minlength="6"
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              v-model="passwordForm.confirm"
              type="password"
              class="form-input"
              required
            />
          </div>

          <div v-if="passwordError" class="error-message">
            {{ passwordError }}
          </div>

          <div class="form-actions">
            <button type="submit" :disabled="changingPassword" class="secondary-button">
              {{ changingPassword ? 'Changing...' : 'Change Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'

const { user, fetchProfile } = useAuth()
const { put } = useApi()

const loading = ref(false)
const changingPassword = ref(false)
const passwordError = ref('')

const profile = ref({
  name: '',
  email: '',
  role: '',
})

const stats = ref({
  articlesRated: 0,
  blindspotsFound: 0,
  daysActive: 0,
})

const passwordForm = ref({
  current: '',
  new: '',
  confirm: '',
})

const updateProfile = async () => {
  loading.value = true
  try {
    // Update profile logic would go here
    console.log('Updating profile:', profile.value)
    // await put('/user/profile', profile.value)
  } catch (error) {
    console.error('Failed to update profile:', error)
  } finally {
    loading.value = false
  }
}

const changePassword = async () => {
  if (passwordForm.value.new !== passwordForm.value.confirm) {
    passwordError.value = 'New passwords do not match'
    return
  }

  changingPassword.value = true
  passwordError.value = ''
  
  try {
    // Change password logic would go here
    console.log('Changing password')
    // await put('/user/change-password', passwordForm.value)
    
    // Reset form
    passwordForm.value = { current: '', new: '', confirm: '' }
  } catch (error: any) {
    passwordError.value = error.message || 'Failed to change password'
  } finally {
    changingPassword.value = false
  }
}

onMounted(async () => {
  try {
    await fetchProfile()
    if (user.value) {
      profile.value = {
        name: user.value.name || '',
        email: user.value.email || '',
        role: user.value.role || '',
      }
    }
    
    // Load user stats (mock data for now)
    stats.value = {
      articlesRated: 47,
      blindspotsFound: 12,
      daysActive: 28,
    }
  } catch (error) {
    console.error('Failed to load profile:', error)
  }
})
</script>

<style scoped>
.profile-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.profile-header {
  margin-bottom: 2rem;
}

.profile-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.profile-header p {
  color: #6b7280;
  font-size: 1.1rem;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.profile-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.profile-card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.profile-form,
.password-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input[readonly] {
  background: #f9fafb;
  color: #6b7280;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  border: 1px solid #fecaca;
}

.form-actions {
  margin-top: 1rem;
}

.primary-button,
.secondary-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.primary-button {
  background: #3b82f6;
  color: white;
}

.primary-button:hover:not(:disabled) {
  background: #2563eb;
}

.secondary-button {
  background: #6b7280;
  color: white;
}

.secondary-button:hover:not(:disabled) {
  background: #4b5563;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .profile-view {
    padding: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
