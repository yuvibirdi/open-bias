'use client'
import { Link } from '@tanstack/react-router'
import { LucideIcon, icons } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { buttonVariants } from '@/components/ui/button'

interface NavProps {
  isCollapsed: boolean
  links: {
    title: string
    label?: string
    icon: keyof typeof icons
    variant: 'default' | 'ghost'
    href: string
  }[]
}

export function Nav({ links, isCollapsed }: NavProps) {

  return (
    <TooltipProvider>
        <div
        data-collapsed={isCollapsed}
        className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
        >
        <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
            {links.map((link, index) => {
            const LucideIcon = icons[link.icon] as LucideIcon
            return isCollapsed ? (
                <Tooltip key={index} delayDuration={0}>
                <TooltipTrigger asChild>
                    <Link
                    to={link.href}
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'h-9 w-9',
                    )}
                    >
                    <LucideIcon className="h-4 w-4" />
                    <span className="sr-only">{link.title}</span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-4">
                    {link.title}
                    {link.label && (
                    <span className="ml-auto text-muted-foreground">
                        {link.label}
                    </span>
                    )}
                </TooltipContent>
                </Tooltip>
            ) : (
                <Link
                key={index}
                to={link.href}
                className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'justify-start'
                )}
                >
                <LucideIcon className="mr-2 h-4 w-4" />
                {link.title}
                {link.label && (
                    <span
                    className={cn(
                        'ml-auto',
                    )}
                    >
                    {link.label}
                    </span>
                )}
                </Link>
            )
            })}
        </nav>
        </div>
    </TooltipProvider>
  )
} 