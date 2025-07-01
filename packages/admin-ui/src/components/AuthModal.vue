<template>
  <div class="auth-container">
    <div class="auth-card">
      <div class="auth-header">
        <h1>{{ isLoginMode ? 'Sign In' : 'Create Account' }}</h1>
        <p>{{ isLoginMode ? 'Welcome back to OpenBias' : 'Join OpenBias for personalized news analysis' }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div v-if="!isLoginMode" class="form-group">
          <label for="name">Full Name</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            class="form-input"
            placeholder="Enter your full name"
          />
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            required
            class="form-input"
            placeholder="Enter your email"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            required
            class="form-input"
            placeholder="Enter your password"
            :minlength="isLoginMode ? 1 : 6"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="auth-button"
        >
          <span v-if="loading" class="loading-spinner"></span>
          {{ loading ? 'Please wait...' : (isLoginMode ? 'Sign In' : 'Create Account') }}
        </button>
      </form>

      <div class="auth-footer">
        <p>
          {{ isLoginMode ? "Don't have an account?" : 'Already have an account?' }}
          <button @click="toggleMode" class="link-button">
            {{ isLoginMode ? 'Sign up' : 'Sign in' }}
          </button>
        </p>
      </div>

      <!-- Demo Credentials (for development) -->
      <div class="demo-section">
        <p class="demo-title">Demo Credentials</p>
        <div class="demo-buttons">
          <button @click="fillDemoUser" class="demo-button">Demo User</button>
          <button @click="fillDemoAdmin" class="demo-button">Demo Admin</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const emit = defineEmits<{
  close: []
}>()

const { login, register } = useAuth()
const router = useRouter()

const isLoginMode = ref(true)
const loading = ref(false)
const error = ref('')

const form = ref({
  name: '',
  email: '',
  password: '',
})

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  error.value = ''
  form.value = { name: '', email: '', password: '' }
}

const handleSubmit = async () => {
  loading.value = true
  error.value = ''

  try {
    if (isLoginMode.value) {
      await login(form.value.email, form.value.password)
    } else {
      await register(form.value.email, form.value.password, form.value.name)
    }
    
    emit('close')
    router.push('/dashboard')
  } catch (err: any) {
    error.value = err.message || 'Authentication failed'
  } finally {
    loading.value = false
  }
}

const fillDemoUser = () => {
  form.value = {
    name: 'Demo User',
    email: 'demo@example.com',
    password: 'demo123',
  }
  isLoginMode.value = true
}

const fillDemoAdmin = () => {
  form.value = {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
  }
  isLoginMode.value = true
}
</script>

<style scoped>
.auth-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.auth-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.auth-header p {
  color: #6b7280;
  font-size: 0.875rem;
}

.auth-form {
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

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  border: 1px solid #fecaca;
}

.auth-button {
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.auth-button:hover:not(:disabled) {
  background: #2563eb;
}

.auth-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.auth-footer {
  text-align: center;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.auth-footer p {
  color: #6b7280;
  font-size: 0.875rem;
}

.link-button {
  background: none;
  border: none;
  color: #3b82f6;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
}

.link-button:hover {
  color: #2563eb;
}

.demo-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  text-align: center;
}

.demo-title {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.demo-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.demo-button {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.demo-button:hover {
  background: #e5e7eb;
}
</style>
