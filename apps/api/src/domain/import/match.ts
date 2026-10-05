/**
 * Pure helpers for reading a statement: how we decide that two descriptions mean the same
 * shop, so an import can guess the category the couple used last time.
 */

/** Words that say nothing about what was bought. */
const NOISE = new Set([
  'compra',
  'cartao',
  'credito',
  'debito',
  'pagamento',
  'pag',
  'pix',
  'ted',
  'doc',
  'transferencia',
  'enviada',
  'recebida',
  'de',
  'da',
  'do',
  'em',
  'no',
  'na',
  'para',
  'com',
  'ltda',
  'me',
  'sa',
  'eireli',
  'br',
  'brasil',
  'parcela',
])

/**
 * Lower-case, no accents, no punctuation and no digits: "PIX ENVIADO - Padaria Açúcar 12/03"
 * becomes "pix enviado padaria acucar". Statements shout and spell the same shop differently.
 */
export function normalizeDescription(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The words worth matching on: normalized, longer than two letters, not noise. */
export function keywordsOf(value: string): string[] {
  return normalizeDescription(value)
    .split(' ')
    .filter((word) => word.length > 2 && !NOISE.has(word))
}

/**
 * How much two descriptions look alike, 0–1: the share of the smaller one's words that the
 * other also has. "Padaria Açúcar" and "PADARIA ACUCAR LTDA" score 1.
 */
export function similarity(a: string, b: string): number {
  const left = new Set(keywordsOf(a))
  const right = new Set(keywordsOf(b))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const word of left) if (right.has(word)) shared += 1
  return shared / Math.min(left.size, right.size)
}

/** Below this two descriptions are different shops, and we would rather guess nothing. */
export const MATCH_THRESHOLD = 0.6

export interface PastRow {
  description: string
  categoryId: string
  /** How many times the couple filed this description under that category. */
  count: number
}

/**
 * The category used for the most similar past description. Ties go to the one used more
 * often, so a shop that moved category once doesn't drag every new line with it.
 */
export function guessCategory(description: string, past: PastRow[]): string | null {
  let best: { score: number; count: number; categoryId: string } | null = null
  for (const row of past) {
    const score = similarity(description, row.description)
    if (score < MATCH_THRESHOLD) continue
    if (!best || score > best.score || (score === best.score && row.count > best.count)) {
      best = { score, count: row.count, categoryId: row.categoryId }
    }
  }
  return best?.categoryId ?? null
}
