/**
 * Simulation physique du tirage dans une roue : les boules roulent dans un tambour qui tourne,
 * une trappe s'ouvre sur le bord et la première boule qui sort est la boule tirée.
 *
 * Toute la simulation est calculée d'avance (le numéro est donc connu dès l'appui), puis
 * simplement rejouée à l'écran. Unités : le tambour a un rayon de 1, le temps est en secondes,
 * l'axe y pointe vers le bas et les angles croissent dans le sens horaire.
 */

/** Un choc pendant la simulation, utilisé pour les bruitages. */
export interface WheelImpact {
  time: number
  /** Force du choc, de 0 à 1. */
  strength: number
  /** Vrai pour un choc contre la paroi ou un pic, faux pour un choc entre boules. */
  wall: boolean
}

export interface WheelSim {
  /** Numéro porté par chaque boule. */
  numbers: number[]
  ballRadius: number
  /** Positions [x0, y0, x1, y1, …] de toutes les boules, une entrée par image. */
  frames: Float32Array[]
  frameRate: number
  /** Vitesse de rotation du tambour, en radians par seconde. */
  omega: number
  /** Angle du centre de la trappe à t = 0. */
  holeAngle: number
  /** Angle à t = 0 de chaque pic fixé sur la paroi. */
  spikeAngles: number[]
  /** Longueur des pics, de la paroi vers le centre. */
  spikeHeight: number
  holeHalfWidth: number
  openTime: number
  exitTime: number
  /** Indice de la boule sortie. */
  winner: number
  impacts: WheelImpact[]
}

/** La roue n'est utilisée que s'il reste moins de boules que cette limite. */
export const WHEEL_MAX_BALLS = 20

const STEP = 1 / 120
const STEPS_PER_FRAME = 2
const OPEN_TIME = 3
/** La boule doit être sortie à ce moment-là pour que l'animation complète tienne en 6 secondes. */
const MAX_EXIT_TIME = 4.95
/** Durée simulée après la sortie : la boule tirée s'arrête juste sous la trappe, la roue continue. */
export const AFTER_EXIT_TIME = 1
/** Espace entre le bord du tambour et la boule sortie, une fois celle-ci arrêtée. */
const EXIT_CLEARANCE = 0.05
/** Part de la distance restante parcourue par la boule sortie à chaque pas de simulation. */
const EXIT_EASING = 0.15

/** Distance au centre du bord extérieur de la boule sortie : le dessin doit aller jusque-là. */
export function wheelExtent(ballRadius: number): number {
  return 1 + EXIT_CLEARANCE + 2 * ballRadius
}
const GRAVITY = 9
const OMEGA = 2.5
const WALL_RESTITUTION = 0.65
const WALL_FRICTION = 0.1
const BALL_RESTITUTION = 0.92
const EDGE_RESTITUTION = 0.4
/** Pics fixés sur la paroi : ils soulèvent les boules et les projettent pour les mélanger. */
const SPIKE_COUNT = 4
const SPIKE_HEIGHT = 0.15
const SPIKE_THICKNESS = 0.015
const SPIKE_RESTITUTION = 0.7
const MAX_ATTEMPTS = 400
/** Vitesse de choc minimale pour produire un bruit, et vitesse donnant le bruit le plus fort. */
const IMPACT_MIN_SPEED = 0.8
const IMPACT_FULL_SPEED = 5
/** Écart minimal entre deux bruits de choc, en secondes. */
const IMPACT_SPACING = 0.03
/** Demi-largeur de la trappe, en rayons de boule (1 = la boule passe tout juste). */
const HOLE_WIDTH = 1.3

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function wrapAngle(angle: number): number {
  const turn = 2 * Math.PI
  return ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI
}

function shuffled(values: number[]): number[] {
  const result = [...values]
  const random = new Uint32Array(result.length)
  crypto.getRandomValues(random)
  for (let i = result.length - 1; i > 0; i--) {
    const j = random[i] % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function placeBalls(count: number, radius: number, random: () => number) {
  const x: number[] = []
  const y: number[] = []
  const limit = 1 - radius
  for (let i = 0; i < count; i++) {
    let px = 0
    let py = 0
    for (let tries = 0; tries < 400; tries++) {
      px = (random() * 2 - 1) * limit
      py = (random() * 2 - 1) * limit
      const inside = Math.hypot(px, py) < limit
      const free = x.every((ox, k) => Math.hypot(px - ox, py - y[k]) > 2 * radius)
      if (inside && free) break
    }
    x.push(px)
    y.push(py)
  }
  return { x, y }
}

function runAttempt(numbers: number[], seed: number): WheelSim | null {
  const count = numbers.length
  const random = seededRandom(seed)
  const radius = Math.min(0.2, 0.52 / Math.sqrt(count))
  const limit = 1 - radius
  const holeHalfWidth = Math.asin(Math.min(1, HOLE_WIDTH * radius))
  // À l'ouverture, la trappe est sur le côté droit et descend vers les boules.
  const holeAngle = (random() - 0.5) * 0.8 - OMEGA * OPEN_TIME

  // Les pics sont répartis régulièrement, à distance de la trappe.
  const spikeAngles = Array.from(
    { length: SPIKE_COUNT },
    (_, k) => holeAngle + ((k + 0.5) * 2 * Math.PI) / SPIKE_COUNT,
  )

  const { x, y } = placeBalls(count, radius, random)
  const vx = Array.from({ length: count }, () => (random() - 0.5) * 2)
  const vy = Array.from({ length: count }, () => (random() - 0.5) * 2)

  const frames: Float32Array[] = []
  const impacts: WheelImpact[] = []
  let winner = -1
  let exitTime = 0
  let now = 0

  const recordImpact = (speed: number, wall: boolean) => {
    if (speed < IMPACT_MIN_SPEED) return
    if (impacts.length > 0 && now - impacts[impacts.length - 1].time < IMPACT_SPACING) return
    impacts.push({ time: now, strength: Math.min(1, speed / IMPACT_FULL_SPEED), wall })
  }

  for (let step = 0; ; step++) {
    const time = step * STEP
    now = time
    if (winner < 0 && time > MAX_EXIT_TIME) return null
    if (winner >= 0 && time > exitTime + AFTER_EXIT_TIME) break

    if (step % STEPS_PER_FRAME === 0) {
      const frame = new Float32Array(count * 2)
      for (let i = 0; i < count; i++) {
        frame[2 * i] = x[i]
        frame[2 * i + 1] = y[i]
      }
      frames.push(frame)
    }

    const hole = holeAngle + OMEGA * time
    const open = winner < 0 && time >= OPEN_TIME

    for (let i = 0; i < count; i++) {
      if (i === winner) {
        // La boule sortie glisse jusqu'à sa place, juste à l'extérieur du tambour.
        const distance = Math.hypot(x[i], y[i])
        const target = wheelExtent(radius) - radius
        const next = distance + (target - distance) * EXIT_EASING
        x[i] *= next / distance
        y[i] *= next / distance
        continue
      }
      vy[i] += GRAVITY * STEP
      x[i] += vx[i] * STEP
      y[i] += vy[i] * STEP
    }

    // Chocs entre boules.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < count; i++) {
        if (i === winner) continue
        for (let j = i + 1; j < count; j++) {
          if (j === winner) continue
          const dx = x[j] - x[i]
          const dy = y[j] - y[i]
          const distance = Math.hypot(dx, dy)
          if (distance >= 2 * radius || distance === 0) continue
          const nx = dx / distance
          const ny = dy / distance
          const overlap = (2 * radius - distance) / 2
          x[i] -= nx * overlap
          y[i] -= ny * overlap
          x[j] += nx * overlap
          y[j] += ny * overlap
          const approach = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny
          if (approach < 0) {
            recordImpact(-approach, false)
            const impulse = (-(1 + BALL_RESTITUTION) * approach) / 2
            vx[i] -= impulse * nx
            vy[i] -= impulse * ny
            vx[j] += impulse * nx
            vy[j] += impulse * ny
          }
        }
      }
    }

    // Pics : des segments qui tournent avec le tambour, de la paroi vers le centre.
    for (const spike of spikeAngles) {
      const angle = spike + OMEGA * time
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      for (let i = 0; i < count; i++) {
        if (i === winner) continue
        // Point du pic le plus proche de la boule.
        const along = Math.min(1, Math.max(1 - SPIKE_HEIGHT, x[i] * ux + y[i] * uy))
        const px = ux * along
        const py = uy * along
        const dx = x[i] - px
        const dy = y[i] - py
        const gap = Math.hypot(dx, dy)
        const reach = radius + SPIKE_THICKNESS
        if (gap >= reach || gap === 0) continue
        const nx = dx / gap
        const ny = dy / gap
        x[i] = px + nx * reach
        y[i] = py + ny * reach
        // Vitesse relative au pic, qui tourne avec le tambour.
        const approach = (vx[i] + OMEGA * py) * nx + (vy[i] - OMEGA * px) * ny
        if (approach < 0) {
          recordImpact(-approach, true)
          vx[i] -= (1 + SPIKE_RESTITUTION) * approach * nx
          vy[i] -= (1 + SPIKE_RESTITUTION) * approach * ny
        }
      }
    }

    // Paroi du tambour, trappe et bords de la trappe.
    for (let i = 0; i < count; i++) {
      if (i === winner) continue
      const distance = Math.hypot(x[i], y[i])
      if (distance <= limit) continue
      const inGap = open && Math.abs(wrapAngle(Math.atan2(y[i], x[i]) - hole)) < holeHalfWidth

      if (!inGap) {
        const nx = x[i] / distance
        const ny = y[i] / distance
        x[i] = nx * limit
        y[i] = ny * limit
        let normal = vx[i] * nx + vy[i] * ny
        let tangent = -vx[i] * ny + vy[i] * nx
        if (normal > 0) {
          recordImpact(normal, true)
          normal = -normal * WALL_RESTITUTION
        }
        // La paroi entraîne les boules dans sa rotation.
        tangent += (OMEGA * limit - tangent) * WALL_FRICTION
        vx[i] = normal * nx - tangent * ny
        vy[i] = normal * ny + tangent * nx
        continue
      }

      if (distance > 1 + 0.3 * radius) {
        winner = i
        exitTime = time
        break
      }

      for (const side of [-1, 1]) {
        const edgeAngle = hole + side * holeHalfWidth
        const ex = Math.cos(edgeAngle)
        const ey = Math.sin(edgeAngle)
        const dx = x[i] - ex
        const dy = y[i] - ey
        const gap = Math.hypot(dx, dy)
        if (gap >= radius || gap === 0) continue
        const nx = dx / gap
        const ny = dy / gap
        x[i] = ex + nx * radius
        y[i] = ey + ny * radius
        // Vitesse relative au bord, qui tourne avec le tambour.
        const relX = vx[i] + OMEGA * ey
        const relY = vy[i] - OMEGA * ex
        const approach = relX * nx + relY * ny
        if (approach < 0) {
          vx[i] -= (1 + EDGE_RESTITUTION) * approach * nx
          vy[i] -= (1 + EDGE_RESTITUTION) * approach * ny
        }
      }
    }
  }

  return {
    numbers,
    ballRadius: radius,
    frames,
    frameRate: 1 / (STEP * STEPS_PER_FRAME),
    omega: OMEGA,
    holeAngle,
    spikeAngles,
    spikeHeight: SPIKE_HEIGHT,
    holeHalfWidth,
    openTime: OPEN_TIME,
    exitTime,
    winner,
    impacts,
  }
}

/**
 * Simule un tirage parmi les numéros donnés. Les numéros sont répartis au hasard sur les boules,
 * indépendamment de la physique : chaque numéro a donc exactement la même chance de sortir.
 * Renvoie null si aucune simulation n'aboutit dans le temps imparti.
 */
export function simulateWheel(remaining: number[]): WheelSim | null {
  const numbers = shuffled(remaining)
  const seeds = new Uint32Array(MAX_ATTEMPTS)
  crypto.getRandomValues(seeds)
  for (const seed of seeds) {
    const sim = runAttempt(numbers, seed)
    if (sim) return sim
  }
  return null
}
