import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PrivacyProvider } from '@/lib/privacy'
import { queryClient } from '@/lib/query-client'
import { ThemeProvider } from '@/lib/theme'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PrivacyProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
