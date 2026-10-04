import type { CategoryIconKey } from '../category-icons'
import type { CategoryKind } from '../enums'
import type { PaletteKey } from '../palette'

export interface DefaultSubcategory {
  name: string
  icon: CategoryIconKey
}

export interface DefaultCategory {
  name: string
  kind: CategoryKind
  icon: CategoryIconKey
  color: PaletteKey
  /** Subcategories inherit the parent's color. */
  children?: readonly DefaultSubcategory[]
}

/**
 * Categories every new household starts with. Used by the seed script and, from Phase 1,
 * by household creation. Order here is the initial `sortOrder`.
 */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  // ───────────── Despesas ─────────────
  {
    name: 'Mercado',
    kind: 'EXPENSE',
    icon: 'shopping-cart',
    color: '700',
    children: [
      { name: 'Supermercado', icon: 'shopping-cart' },
      { name: 'Feira & hortifrúti', icon: 'apple' },
      { name: 'Padaria', icon: 'croissant' },
    ],
  },
  {
    name: 'Moradia',
    kind: 'EXPENSE',
    icon: 'house',
    color: '900',
    children: [
      { name: 'Aluguel', icon: 'key' },
      { name: 'Condomínio', icon: 'building' },
      { name: 'Energia', icon: 'zap' },
      { name: 'Água', icon: 'droplet' },
      { name: 'Internet', icon: 'wifi' },
      { name: 'Gás', icon: 'flame' },
      { name: 'Manutenção', icon: 'wrench' },
    ],
  },
  {
    name: 'Transporte',
    kind: 'EXPENSE',
    icon: 'car',
    color: '500',
    children: [
      { name: 'Combustível', icon: 'fuel' },
      { name: 'Aplicativos', icon: 'car' },
      { name: 'Transporte público', icon: 'bus' },
      { name: 'Estacionamento', icon: 'parking' },
    ],
  },
  {
    name: 'Restaurantes',
    kind: 'EXPENSE',
    icon: 'utensils',
    color: '300',
    children: [
      { name: 'Delivery', icon: 'pizza' },
      { name: 'Restaurante', icon: 'utensils' },
      { name: 'Bares', icon: 'beer' },
      { name: 'Cafés', icon: 'coffee' },
    ],
  },
  {
    name: 'Lazer',
    kind: 'EXPENSE',
    icon: 'party-popper',
    color: '500',
    children: [
      { name: 'Cinema & shows', icon: 'clapperboard' },
      { name: 'Passeios', icon: 'ticket' },
      { name: 'Jogos', icon: 'gamepad' },
    ],
  },
  {
    name: 'Saúde',
    kind: 'EXPENSE',
    icon: 'heart-pulse',
    color: '300',
    children: [
      { name: 'Farmácia', icon: 'pill' },
      { name: 'Consultas & exames', icon: 'stethoscope' },
      { name: 'Plano de saúde', icon: 'shield-plus' },
      { name: 'Academia', icon: 'dumbbell' },
    ],
  },
  {
    name: 'Assinaturas',
    kind: 'EXPENSE',
    icon: 'repeat',
    color: '700',
    children: [
      { name: 'Streaming', icon: 'tv' },
      { name: 'Apps & software', icon: 'app-window' },
      { name: 'Música', icon: 'music' },
    ],
  },
  {
    name: 'Pets',
    kind: 'EXPENSE',
    icon: 'paw-print',
    color: '900',
    children: [
      { name: 'Ração & petiscos', icon: 'bone' },
      { name: 'Veterinário', icon: 'stethoscope' },
      { name: 'Banho & tosa', icon: 'scissors' },
    ],
  },
  {
    name: 'Compras',
    kind: 'EXPENSE',
    icon: 'shopping-bag',
    color: '500',
    children: [
      { name: 'Roupas', icon: 'shirt' },
      { name: 'Eletrônicos', icon: 'smartphone' },
      { name: 'Casa & decoração', icon: 'sofa' },
    ],
  },
  {
    name: 'Cuidados pessoais',
    kind: 'EXPENSE',
    icon: 'sparkles',
    color: '300',
    children: [
      { name: 'Cabelo', icon: 'scissors' },
      { name: 'Cosméticos', icon: 'sparkles' },
    ],
  },
  {
    name: 'Educação',
    kind: 'EXPENSE',
    icon: 'graduation-cap',
    color: '700',
    children: [
      { name: 'Cursos', icon: 'graduation-cap' },
      { name: 'Livros', icon: 'book-open' },
    ],
  },
  { name: 'Viagens', kind: 'EXPENSE', icon: 'plane', color: '500' },
  { name: 'Presentes', kind: 'EXPENSE', icon: 'gift', color: '300' },
  {
    name: 'Impostos & taxas',
    kind: 'EXPENSE',
    icon: 'landmark',
    color: 'neutral',
    children: [
      { name: 'Tarifas bancárias', icon: 'receipt' },
      { name: 'IPVA & licenciamento', icon: 'car' },
      { name: 'IPTU', icon: 'house' },
    ],
  },
  { name: 'Outros', kind: 'EXPENSE', icon: 'ellipsis', color: 'neutral' },

  // ───────────── Receitas ─────────────
  { name: 'Salário', kind: 'INCOME', icon: 'briefcase', color: '700' },
  { name: 'Freela', kind: 'INCOME', icon: 'laptop', color: '500' },
  { name: 'Rendimentos', kind: 'INCOME', icon: 'trending-up', color: '900' },
  { name: 'Reembolsos', kind: 'INCOME', icon: 'undo', color: '300' },
  { name: 'Outras receitas', kind: 'INCOME', icon: 'circle-plus', color: 'neutral' },
]
