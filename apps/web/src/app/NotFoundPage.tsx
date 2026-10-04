import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/empty-state/EmptyState'
import { Button } from '@/components/ui/button'

import { ROUTES } from './navigation'

export function NotFoundPage() {
  return (
    <div className="blueprint border border-border">
      <EmptyState
        icon={MapPinOff}
        title="Essa página não existe"
        description="O link pode estar quebrado ou a página mudou de lugar."
        action={
          <Button asChild variant="secondary">
            <Link to={ROUTES.dashboard}>Voltar ao painel</Link>
          </Button>
        }
      />
    </div>
  )
}
