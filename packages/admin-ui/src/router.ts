import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from './pages/LandingPage.vue'
import AdminArticlesPage from './pages/AdminArticlesPage.vue' 
import SourcesPage  from './pages/SourcesPage.vue'
import ExplorePage from './pages/ExplorePage.vue'
import BlindspotPage from './pages/BlindspotPage.vue'

// Placeholder for new pages/features
const NewExplorePagePlaceholder = { template: '<div class="p-6 text-gray-800"><h1>Explore Articles</h1><p>This page will soon feature a new layout for browsing articles, similar to Ground News. For now, you can use the Admin Articles link.</p></div>' };

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Home', component: LandingPage },
    { path: '/explore', name: 'Explore', component: ExplorePage }, 
    { path: '/blindspot', name: 'Blindspot', component: BlindspotPage },
    
    // Admin pages
    { path: '/admin/articles', name: 'AdminArticles', component: AdminArticlesPage },
    { path: '/admin/sources', name: 'AdminSources', component: SourcesPage  }
  ]
})