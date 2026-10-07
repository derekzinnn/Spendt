/**
 * How we compare what someone typed against what is on screen.
 *
 * Accents are dropped on both sides: in pt-BR nobody types "Saúde" with the accent when
 * searching, and a search that misses it is worse than useless here — the quick add would
 * offer to CREATE "saude" next to the "Saúde" that already exists.
 */
export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}
