<template>
  <div class="c-app c-default-layout">
    <!-- Simple Sidebar -->
    <div class="c-sidebar c-sidebar-dark c-sidebar-fixed c-sidebar-lg-show" id="sidebar">
      <div class="c-sidebar-brand d-lg-down-none">
        <h4 class="text-white p-3">OpenBias Admin</h4>
      </div>
      <ul class="c-sidebar-nav">
        <li class="c-sidebar-nav-item">
          <router-link to="/" class="c-sidebar-nav-link">
            <span class="c-sidebar-nav-icon">📊</span>
            Dashboard
          </router-link>
        </li>
        <li class="c-sidebar-nav-item">
          <router-link to="/articles" class="c-sidebar-nav-link">
            <span class="c-sidebar-nav-icon">📰</span>
            Articles
          </router-link>
        </li>
        <li class="c-sidebar-nav-item">
          <router-link to="/sources" class="c-sidebar-nav-link">
            <span class="c-sidebar-nav-icon">📡</span>
            Sources
          </router-link>
        </li>
      </ul>
    </div>

    <!-- Main Content -->
    <div class="c-wrapper">
      <!-- Header -->
      <header class="c-header c-header-light c-header-fixed">
        <div class="container-fluid">
          <button class="c-header-toggler c-class-toggler d-lg-none" type="button">
            ☰
          </button>
          <div class="c-header-brand d-lg-none">
            OpenBias
          </div>
          <div class="c-header-nav ml-auto">
            <div class="c-header-nav-item">
              <span class="text-muted">Admin Panel</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Body -->
      <div class="c-body">
        <main class="c-main">
          <div class="container-fluid p-4">
            <router-view />
          </div>
        </main>
      </div>

      <!-- Footer -->
      <footer class="c-footer">
        <div class="container-fluid">
          <span class="text-muted">&copy; 2024 OpenBias Admin</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
// Simple layout without complex dependencies
</script>

<style scoped>
.c-app {
  display: flex;
  min-height: 100vh;
}

.c-sidebar {
  width: 256px;
  background: #2f353a;
  color: white;
  flex-shrink: 0;
}

.c-sidebar-brand {
  border-bottom: 1px solid #3a4049;
}

.c-sidebar-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}

.c-sidebar-nav-item {
  border-bottom: 1px solid #3a4049;
}

.c-sidebar-nav-link {
  display: block;
  padding: 1rem 1.5rem;
  color: #c2c6ca;
  text-decoration: none;
  transition: all 0.2s;
}

.c-sidebar-nav-link:hover,
.c-sidebar-nav-link.router-link-active {
  background: #4f5962;
  color: white;
}

.c-sidebar-nav-icon {
  margin-right: 0.5rem;
}

.c-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.c-header {
  background: white;
  border-bottom: 1px solid #dee2e6;
  padding: 0.5rem 0;
  flex-shrink: 0;
}

.c-body {
  flex: 1;
  background: #f8f9fa;
}

.c-main {
  height: 100%;
}

.c-footer {
  background: white;
  border-top: 1px solid #dee2e6;
  padding: 1rem 0;
  flex-shrink: 0;
}
</style>
