/** Une grille : une liste de lignes, chaque ligne étant une liste de numéros. */
export type Card = number[][]

export const CARD_ROWS = 3
export const CARD_COLS = 5

const PREFIX = 'LOTO1:'

export function encodeCard(card: Card): string {
  return PREFIX + card.map((row) => row.join(',')).join('/')
}

export function decodeCard(text: string): Card | null {
  if (!text.startsWith(PREFIX)) return null
  const rows = text
    .slice(PREFIX.length)
    .split('/')
    .map((row) => row.split(',').map(Number))
  const valid = rows.every((row) => row.every((n) => Number.isInteger(n) && n > 0))
  return valid ? rows : null
}

/** Numéros de la grille qui ne sont pas encore sortis, par ordre croissant. */
export function missingNumbers(card: Card, drawn: Iterable<number>): number[] {
  const out = new Set(drawn)
  return card
    .flat()
    .filter((n) => !out.has(n))
    .sort((a, b) => a - b)
}
