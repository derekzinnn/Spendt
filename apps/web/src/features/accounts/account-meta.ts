import type { AccountType } from '@spendly/shared'
import { Landmark, PiggyBank, UtensilsCrossed, Wallet, type LucideIcon } from 'lucide-react'

export const ACCOUNT_TYPE_META: Record<AccountType, { icon: LucideIcon; short: string }> = {
  CHECKING: { icon: Landmark, short: 'Conta corrente' },
  SAVINGS: { icon: PiggyBank, short: 'Reserva' },
  CASH: { icon: Wallet, short: 'Dinheiro' },
  BENEFIT: { icon: UtensilsCrossed, short: 'VR / VA' },
}
