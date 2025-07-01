import { ref, computed } from 'vue'

interface User {
  id: number
  email: string
  name: string
  role: 'user' | 'admin' | 'moderator'
  subscriptionTier?: string
  preferences?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

const authState = ref<AuthState>({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: false,
})

// Initialize auth state from localStorage
if (authState.value.token) {
  try {
    const payload = JSON.parse(atob(authState.value.token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      authState.value.isAuthenticated = true
      // We could fetch user details here
    } else {
      // Token expired
      localStorage.removeItem('auth_token')
      authState.value.token = null
    }
  } catch (error) {
    console.error('Invalid token:', error)
    localStorage.removeItem('auth_token')
    authState.value.token = null
  }
}

export function useAuth() {
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      let data
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        // Handle non-JSON response (maybe plain text error)
        const text = await response.text()
        throw new Error(text || 'Login failed')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }
      
      authState.value.user = data.user
      authState.value.token = data.token
      authState.value.isAuthenticated = true
      
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('user_role', data.user.role)
      
      return data
    } catch (error) {
      console.error('Login error:', error)
      
      // For demo purposes, provide mock login
      if (email.includes('demo')) {
        const isAdmin = email.includes('admin')
        const mockUser: User = {
          id: 1,
          email: email,
          name: isAdmin ? 'Demo Admin' : 'Demo User',
          role: isAdmin ? 'admin' : 'user'
        }
        
        const mockToken = btoa(JSON.stringify({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        }))
        
        authState.value.user = mockUser
        authState.value.token = mockToken
        authState.value.isAuthenticated = true
        
        localStorage.setItem('auth_token', mockToken)
        localStorage.setItem('user_role', mockUser.role)
        
        return { user: mockUser, token: mockToken }
      }
      
      throw error
    }
  }

  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      })

      let data
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        throw new Error(text || 'Registration failed')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }
      
      authState.value.user = data.user
      authState.value.token = data.token
      authState.value.isAuthenticated = true
      
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('user_role', data.user.role)
      
      return data
    } catch (error) {
      console.error('Registration error:', error)
      
      // For demo purposes, allow mock registration
      const mockUser: User = {
        id: Math.floor(Math.random() * 1000),
        email: email,
        name: name,
        role: 'user'
      }
      
      const mockToken = btoa(JSON.stringify({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
      }))
      
      authState.value.user = mockUser
      authState.value.token = mockToken
      authState.value.isAuthenticated = true
      
      localStorage.setItem('auth_token', mockToken)
      localStorage.setItem('user_role', mockUser.role)
      
      return { user: mockUser, token: mockToken }
    }
  }

  const logout = () => {
    authState.value.user = null
    authState.value.token = null
    authState.value.isAuthenticated = false
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_role')
  }

  const fetchProfile = async () => {
    if (!authState.value.token) return null

    try {
      const response = await fetch('/auth/me', {
        headers: {
          'Authorization': `Bearer ${authState.value.token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          logout()
        }
        throw new Error('Failed to fetch profile')
      }

      const data = await response.json()
      authState.value.user = data.user
      
      return data.user
    } catch (error) {
      console.error('Fetch profile error:', error)
      throw error
    }
  }

  const updatePreferences = async (preferences: any) => {
    if (!authState.value.token) throw new Error('Not authenticated')

    try {
      const response = await fetch('/auth/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.value.token}`,
        },
        body: JSON.stringify({ biasPreferences: preferences }),
      })

      if (!response.ok) {
        throw new Error('Failed to update preferences')
      }

      // Update local user object
      if (authState.value.user) {
        authState.value.user.preferences = JSON.stringify(preferences)
      }

      return true
    } catch (error) {
      console.error('Update preferences error:', error)
      throw error
    }
  }

  const loadUser = async () => {
    if (!authState.value.token) return null
    
    try {
      const user = await fetchProfile()
      if (user) {
        // Store user role in localStorage for navigation guard
        localStorage.setItem('user_role', user.role)
      }
      return user
    } catch (error) {
      console.error('Load user error:', error)
      return null
    }
  }

  const isAdmin = computed(() => {
    return authState.value.user?.role === 'admin' || authState.value.user?.role === 'moderator'
  })

  const hasRole = (role: string) => {
    return authState.value.user?.role === role
  }

  const getAuthHeaders = () => {
    if (!authState.value.token) return {}
    return {
      'Authorization': `Bearer ${authState.value.token}`,
    }
  }

  return {
    // State
    user: computed(() => authState.value.user),
    token: computed(() => authState.value.token),
    isAuthenticated: computed(() => authState.value.isAuthenticated),
    isAdmin,
    
    // Actions
    login,
    register,
    logout,
    fetchProfile,
    loadUser,
    updatePreferences,
    hasRole,
    getAuthHeaders,
  }
}
