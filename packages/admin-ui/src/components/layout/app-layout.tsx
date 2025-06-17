import { Outlet } from '@tanstack/react-router'
import Sidebar from '@/components/layout/sidebar'
import Header from '@/components/layout/header'

export default function AppLayout() {
  return (
    <>
      <Header />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto pt-16">
          <Outlet />
        </main>
      </div>
    </>
  )
} 