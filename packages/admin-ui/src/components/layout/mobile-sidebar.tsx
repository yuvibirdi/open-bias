'use client'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Menu, Telescope } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Nav } from '@/components/layout/nav'

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="!px-0">
          <div className="space-y-4 py-4">
            <div className="px-3 py-2">
              <SheetHeader className="mb-2 px-4">
                <SheetTitle>
                  <Telescope className="mr-2 inline-block" />
                  OpenBias
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Admin navigation sidebar.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-1">
                <Nav
                  isCollapsed={false}
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
        </SheetContent>
      </Sheet>
    </>
  )
} 