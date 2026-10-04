import { CloudOff } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'

import { EmptyState } from '@/components/empty-state/EmptyState'
import { Button } from '@/components/ui/button'

/** Last line of defense: a screen crashed or failed to load. */
export function RouteErrorPage() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="blueprint w-full max-w-md border border-border">
        <EmptyState
          icon={CloudOff}
          title="Algo deu errado por aqui"
          description={
            <>
              Recarregue a página — se continuar, tente de novo em alguns minutos.
              {detail ? (
                <span className="mt-2 block font-mono text-xs opacity-70">{detail}</span>
              ) : null}
            </>
          }
          action={<Button onClick={() => window.location.reload()}>Recarregar</Button>}
        />
      </div>
    </div>
  )
}
