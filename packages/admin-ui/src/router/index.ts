import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'UniversalLayout',
    component: () => import('../views/UniversalLayout.vue'),
    children: [
      {
        path: '',
        redirect: '/stories',
      },
      {
        path: 'stories',
        name: 'Stories',
        component: () => import('../views/Stories.vue'),
      },
      {
        path: 'story/:id',
        name: 'StoryDetail',
        component: () => import('../views/StoryDetail.vue'),
        props: true,
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'articles',
        name: 'Articles',
        component: () => import('../views/Articles.vue'),
        meta: { requiresAdmin: true },
      },
      {
        path: 'sources',
        name: 'Sources',
        component: () => import('../views/Sources.vue'),
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/Profile.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'preferences',
        name: 'Preferences',
        component: () => import('../views/Preferences.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'history',
        name: 'History',
        component: () => import('../views/History.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'story/:id',
        name: 'StoryDetail',
        component: () => import('../views/StoryDetail.vue'),
        props: true,
      },
    ],
  },
  {
    path: '/admin',
    name: 'AdminLayout', 
    component: () => import('../views/DefaultLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: '/admin/dashboard',
      },
      {
        path: 'dashboard',
        name: 'AdminDashboard',
        component: () => import('../views/Dashboard.vue'),
      },
      {
        path: 'articles',
        name: 'AdminArticles',
        component: () => import('../views/Articles.vue'),
      },
      {
        path: 'sources',
        name: 'AdminSources',
        component: () => import('../views/Sources.vue'),
      },
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/404',
    name: 'Page404',
    component: () => import('../views/Page404.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard for authentication and admin access
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('auth_token')
  const userRole = localStorage.getItem('user_role')
  const isAuthenticated = !!token
  const isAdmin = userRole === 'admin' || userRole === 'moderator'
  
  // Check admin requirements
  if (to.meta.requiresAdmin && !isAdmin) {
    // Non-admin users trying to access admin routes get redirected to stories
    next('/stories')
    return
  }
  
  // Check authentication requirements  
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Redirect to stories page where auth modal can be triggered
    next('/stories')
    return
  }
  
  next()
})

export default router