'use client'
import { useState } from 'react'
import { Telescope, ChevronLeft } from 'lucide-react'
import { Nav } from './nav'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  function toggleSidebar() {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div
      className={cn(
        'relative hidden h-screen border-r pt-16 lg:block',
        isCollapsed ? 'w-20' : 'w-72'
      )}
    >
      <TooltipProvider>
        <div className="absolute right-[-20px] top-1/2 z-20">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-10 rounded-full p-0"
                onClick={toggleSidebar}
              >
                <ChevronLeft
                  className={cn(
                    'h-6 w-6 transition-transform',
                    isCollapsed && 'rotate-180'
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            <Telescope className="mr-2 inline-block" />
            {!isCollapsed && 'OpenBias'}
          </h2>
          <div className="space-y-1">
            <Nav
              isCollapsed={isCollapsed}
              links={[
                {
                  title: 'Dashboard',
                  href: '/',
                  icon: 'LayoutDashboard',
                  variant: 'default',
                },
                {
                  title: 'Articles',
                  href: '/articles',
                  icon: 'Newspaper',
                  variant: 'ghost',
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 