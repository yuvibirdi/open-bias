export default [
  {
    component: 'CNavItem',
    name: 'Dashboard',
    to: '/dashboard',
    icon: 'cil-speedometer',
    badge: {
      color: 'primary',
      text: 'NEW',
    },
  },
  {
    component: 'CNavTitle',
    name: 'Content',
  },
  {
    component: 'CNavItem',
    name: 'Articles',
    to: '/articles',
    icon: 'cil-description',
  },
  {
    component: 'CNavItem',
    name: 'Sources',
    to: '/sources',
    icon: 'cil-rss',
  },
]
