import {
  Calendar,
  FileUp,
  Repeat,
  CreditCard,
  LayoutDashboard,
  Palette,
  Settings2,
  Sheet,
  Tag,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  /** Shorter label for the mobile bottom bar and the "Mais" sheet. */
  shortLabel?: string
  icon: LucideIcon
  /** Roadmap phase that delivers the screen (see CLAUDE.md). */
  phase: number
  description: string
  /** The screen reads the shared month (the header shows the month picker). */
  monthly?: boolean
}

export const ROUTES = {
  login: '/entrar',
  register: '/criar-conta',
  invite: '/convite/:token',
  dashboard: '/',
  transactions: '/lancamentos',
  recurring: '/recorrencias',
  bills: '/contas-a-pagar',
  incomes: '/receitas',
  cards: '/cartoes',
  accounts: '/contas',
  categories: '/categorias',
  import: '/importar',
  settings: '/configuracoes',
  design: '/design',
} as const

const DASHBOARD: NavItem = {
  to: ROUTES.dashboard,
  label: 'Painel',
  icon: LayoutDashboard,
  phase: 5,
  monthly: true,
  description:
    'Receitas, despesas e saldo do mês, previsão até o fim do mês, gastos por categoria, faturas e contas a vencer — tudo clicável.',
}

const TRANSACTIONS: NavItem = {
  to: ROUTES.transactions,
  label: 'Lançamentos',
  shortLabel: 'Lançar',
  icon: Sheet,
  phase: 3,
  monthly: true,
  description:
    'A planilha da casa: edição direto na grade, navegação por teclado, filtros, agrupamentos e totais sempre visíveis.',
}

const RECURRING: NavItem = {
  to: ROUTES.recurring,
  label: 'Recorrências',
  icon: Repeat,
  phase: 3,
  description:
    'O que se repete todo mês: aluguel, assinaturas, salário. Na conta ou no cartão, com confirmação automática no dia.',
}

const INCOMES: NavItem = {
  to: ROUTES.incomes,
  label: 'Receitas',
  icon: TrendingUp,
  phase: 4,
  monthly: true,
  description: 'Salários, freelas e rendimentos da casa, previstos e recebidos.',
}

const BILLS: NavItem = {
  to: ROUTES.bills,
  label: 'Contas a pagar',
  shortLabel: 'A pagar',
  icon: Calendar,
  phase: 4,
  monthly: true,
  description:
    'Tudo que vence — boletos, recorrências e faturas — em lista e calendário, com atrasos em destaque.',
}

const CARDS: NavItem = {
  to: ROUTES.cards,
  label: 'Cartões & Faturas',
  shortLabel: 'Cartões',
  icon: CreditCard,
  phase: 2,
  monthly: true,
  description:
    'Cada cartão com sua fatura atual, limite disponível, linha do tempo de faturas e parcelas.',
}

const ACCOUNTS: NavItem = {
  to: ROUTES.accounts,
  label: 'Contas',
  icon: Wallet,
  phase: 1,
  description:
    'Contas correntes, reservas, carteira e VR/VA, com saldo sempre calculado a partir dos lançamentos.',
}

const CATEGORIES: NavItem = {
  to: ROUTES.categories,
  label: 'Categorias & Orçamentos',
  shortLabel: 'Categorias',
  icon: Tag,
  phase: 1,
  description: 'Categorias e subcategorias com ícone, tom e orçamento mensal.',
}

const IMPORT: NavItem = {
  to: ROUTES.import,
  label: 'Importar extrato',
  shortLabel: 'Importar',
  icon: FileUp,
  phase: 6,
  description:
    'Traga o extrato do banco ou a fatura do cartão: o arquivo é lido no seu aparelho e você confere linha por linha antes de gravar.',
}

export const SETTINGS_ITEM: NavItem = {
  to: ROUTES.settings,
  label: 'Configurações',
  shortLabel: 'Ajustes',
  icon: Settings2,
  phase: 1,
  description: 'A casa, o convite para o seu par e as preferências.',
}

export const DESIGN_ITEM: NavItem = {
  to: ROUTES.design,
  label: 'Sistema de design',
  shortLabel: 'Design',
  icon: Palette,
  phase: 0,
  description: 'Tokens, tipografia e componentes base.',
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Visão', items: [DASHBOARD] },
  { title: 'Registro', items: [TRANSACTIONS, RECURRING, INCOMES, BILLS] },
  { title: 'Cadastros', items: [CARDS, ACCOUNTS, CATEGORIES, IMPORT, SETTINGS_ITEM] },
]

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_SECTIONS.flatMap((s) => s.items), DESIGN_ITEM]

/** Mobile bottom bar: two destinations, the quick-add square, two more. */
export const BOTTOM_NAV_LEFT: NavItem[] = [DASHBOARD, TRANSACTIONS]
export const BOTTOM_NAV_RIGHT: NavItem[] = [CARDS, BILLS]
