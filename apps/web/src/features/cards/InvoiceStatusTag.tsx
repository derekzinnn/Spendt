import { type InvoiceStatus, INVOICE_STATUS_LABELS } from '@spendly/shared'
import { CircleAlert, CircleCheck, Clock3, Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

const STATUS_TONE = {
  open: 'outline',
  closed: 'primary',
  paid: 'neutral',
  partially_paid: 'warning',
  overdue: 'negative',
} as const

const STATUS_ICON = {
  open: Clock3,
  closed: Lock,
  paid: CircleCheck,
  partially_paid: CircleAlert,
  overdue: CircleAlert,
}

/** Invoice status as a tag: icon + word, never colour alone. */
export function InvoiceStatusTag({ status }: { status: InvoiceStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <Badge tone={STATUS_TONE[status]}>
      <Icon aria-hidden /> {INVOICE_STATUS_LABELS[status]}
    </Badge>
  )
}
