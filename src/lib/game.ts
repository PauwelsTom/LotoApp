export type DrawAnimation = 'classic' | 'wheel'

export interface Game {
  maxBalls: number
  drawn: number[]
  voice: boolean
  animation: DrawAnimation
  /** Numéros attendus, choisis par l'animateur : leur boule est verte et leur tirage est fêté. */
  marked: number[]
}

export const MIN_BALLS = 5
export const MAX_BALLS = 100

const STORAGE_KEY = 'loto-game-v1'
const DEFAULT_GAME: Game = {
  maxBalls: 90,
  drawn: [],
  voice: true,
  animation: 'classic',
  marked: [],
}

export function isValidBallCount(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_BALLS && n <= MAX_BALLS
}

export function loadGame(): Game {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_GAME
    const saved = JSON.parse(raw) as Partial<Game>
    const maxBalls = saved.maxBalls
    if (typeof maxBalls !== 'number' || !isValidBallCount(maxBalls) || !Array.isArray(saved.drawn)) {
      return DEFAULT_GAME
    }
    const inRange = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= maxBalls
    const drawn = saved.drawn.filter(inRange)
    const marked = Array.isArray(saved.marked) ? saved.marked.filter(inRange) : []
    return {
      maxBalls,
      drawn: [...new Set(drawn)],
      voice: saved.voice !== false,
      animation: saved.animation === 'wheel' ? 'wheel' : 'classic',
      marked: [...new Set(marked)],
    }
  } catch {
    return DEFAULT_GAME
  }
}

export function saveGame(game: Game): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game))
  } catch {
    // Stockage indisponible (navigation privée, quota) : la partie continue sans sauvegarde.
  }
}

export function pickRandom(values: number[]): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return values[buffer[0] % values.length]
}

export function remainingBalls(game: Game): number[] {
  const drawn = new Set(game.drawn)
  const remaining: number[] = []
  for (let n = 1; n <= game.maxBalls; n++) {
    if (!drawn.has(n)) remaining.push(n)
  }
  return remaining
}
