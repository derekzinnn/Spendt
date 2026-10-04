import { Link } from 'react-router'

import { ROUTES, type NavItem } from '@/app/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/** Stand-in for screens that arrive in later phases of the roadmap. */
export function PlaceholderPage({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <div className="blueprint flex flex-col items-center gap-2.5 border border-border px-6 py-16 text-center">
      <Badge tone="outline">Chega na Fase {item.phase}</Badge>
      <Icon aria-hidden className="mt-2 size-9 text-steel" />
      <h2 className="text-[25px]">{item.label}</h2>
      <p className="max-w-105 text-sm text-pretty text-muted-foreground">{item.description}</p>
      <Button asChild variant="secondary" className="mt-2">
        <Link to={ROUTES.dashboard}>Voltar ao painel</Link>
      </Button>
    </div>
  )
}
