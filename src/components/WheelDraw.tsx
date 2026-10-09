import { useEffect, useEffectEvent, useRef } from 'react'
import { playWheel } from '../lib/sound'
import { AFTER_EXIT_TIME, wheelExtent, type WheelSim } from '../lib/wheel'

/** Durée du zoom final : la boule sortie vient remplir l'écran. Avant cela, elle reste en évidence. */
const ZOOM_SECONDS = Math.min(0.55, AFTER_EXIT_TIME)
/** Marge autour de la roue, en proportion de la demi-largeur du dessin. */
const MARGIN = 0.03
/** Au-delà, les écrans très denses coûtent cher à dessiner sans gain visible sur des boules en mouvement. */
const MAX_PIXEL_RATIO = 2
/** Place laissée autour d'une boule dans son image, en rayons : assez pour le halo, ou juste le bord. */
const HALO_PADDING = 1
const PLAIN_PADDING = 0.04
/** Rayon maximal de l'image de la boule tirée utilisée pour le zoom, en pixels. */
const MAX_ZOOM_RADIUS = 512

interface WheelDrawProps {
  sim: WheelSim
  /** Numéros dont la boule est verte. */
  marked: number[]
  /** Joue les bruits de chocs et de sortie de la boule. */
  sounds: boolean
  onDone: () => void
}

function drawBall(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  label: number,
  highlighted: boolean,
  lucky: boolean,
) {
  const gradient = context.createRadialGradient(
    x - 0.3 * radius,
    y - 0.44 * radius,
    0,
    x - 0.3 * radius,
    y - 0.44 * radius,
    1.6 * radius,
  )
  gradient.addColorStop(0, lucky ? '#dcffe9' : '#fff3c4')
  gradient.addColorStop(0.38, lucky ? '#3ed07a' : '#ffc93c')
  gradient.addColorStop(1, lucky ? '#1c8f4d' : '#e09a00')
  context.beginPath()
  context.arc(x, y, radius, 0, 2 * Math.PI)
  context.fillStyle = gradient
  if (highlighted) {
    context.shadowColor = '#ffffff'
    context.shadowBlur = radius * 0.8
  }
  context.fill()
  context.shadowBlur = 0
  if (highlighted) {
    context.lineWidth = radius * 0.12
    context.strokeStyle = '#ffffff'
    context.stroke()
  }
  context.fillStyle = '#1a1300'
  context.font = `800 ${radius * 1.05}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(label), x, y + radius * 0.06)
}

function drawDrum(context: CanvasRenderingContext2D, sim: WheelSim, time: number, scale: number) {
  const hole = sim.holeAngle + sim.omega * time
  const open = time >= sim.openTime && time < sim.exitTime
  const rim = 0.05 * scale
  const rimRadius = scale + rim / 2

  context.beginPath()
  context.arc(0, 0, scale, 0, 2 * Math.PI)
  context.fillStyle = 'rgba(255, 255, 255, 0.07)'
  context.fill()

  // Les pics qui soulèvent les boules.
  const spikeHalfBase = 0.05
  context.fillStyle = '#dfe6ff'
  for (const spike of sim.spikeAngles) {
    const angle = spike + sim.omega * time
    const tip = scale * (1 - sim.spikeHeight)
    context.beginPath()
    context.moveTo(Math.cos(angle - spikeHalfBase) * scale, Math.sin(angle - spikeHalfBase) * scale)
    context.lineTo(Math.cos(angle) * tip, Math.sin(angle) * tip)
    context.lineTo(Math.cos(angle + spikeHalfBase) * scale, Math.sin(angle + spikeHalfBase) * scale)
    context.closePath()
    context.fill()
  }

  context.lineWidth = rim
  context.strokeStyle = '#dfe6ff'
  context.beginPath()
  context.arc(0, 0, rimRadius, hole + sim.holeHalfWidth, hole - sim.holeHalfWidth + 2 * Math.PI)
  context.stroke()

  // La trappe : fermée en rouge, ouverte en laissant un vide dans le bord.
  if (!open) {
    context.strokeStyle = '#ff7676'
    context.beginPath()
    context.arc(0, 0, rimRadius, hole - sim.holeHalfWidth, hole + sim.holeHalfWidth)
    context.stroke()
  }
}

/**
 * Dessine une boule une fois pour toutes dans une image à part. La recopier à chaque image
 * de l'animation coûte bien moins cher que de refaire son dégradé, son texte et son halo.
 */
function makeSprite(radius: number, label: number, highlighted: boolean, lucky: boolean) {
  const sprite = document.createElement('canvas')
  const half = Math.ceil(radius * (1 + (highlighted ? HALO_PADDING : PLAIN_PADDING)))
  sprite.width = 2 * half
  sprite.height = 2 * half
  const context = sprite.getContext('2d')
  if (context) drawBall(context, half, half, radius, label, highlighted, lucky)
  return sprite
}

export function WheelDraw({ sim, marked, sounds, onDone }: WheelDrawProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const finish = useEffectEvent(onDone)
  const isLucky = useEffectEvent((label: number) => marked.includes(label))

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      finish()
      return
    }

    const lastFrame = sim.frames.length - 1
    const totalSeconds = lastFrame / sim.frameRate
    const zoomStart = totalSeconds - ZOOM_SECONDS
    const winner = sim.winner
    let start: number | null = null
    let request = 0
    let sprites: HTMLCanvasElement[] = []
    let winnerHalo: HTMLCanvasElement | null = null
    let winnerZoom: HTMLCanvasElement | null = null

    const render = (now: number) => {
      // L'horloge démarre à la première image : l'horodatage d'une image peut précéder l'appel.
      start ??= now
      const time = (now - start) / 1000
      if (time >= totalSeconds) {
        finish()
        return
      }

      const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
      const size = Math.round(canvas.clientWidth * pixelRatio)
      const half = size / 2
      const scale = (half * (1 - MARGIN)) / wheelExtent(sim.ballRadius)
      const radius = sim.ballRadius * scale
      if (canvas.width !== size || !winnerHalo || !winnerZoom) {
        canvas.width = size
        canvas.height = size
        const label = sim.numbers[winner]
        sprites = sim.numbers.map((n) => makeSprite(radius, n, false, isLucky(n)))
        winnerHalo = makeSprite(radius, label, true, isLucky(label))
        // La boule tirée en grand, pour le zoom final : la réduire reste net et coûte peu.
        winnerZoom = makeSprite(Math.min(half, MAX_ZOOM_RADIUS), label, false, isLucky(label))
      }
      const stamp = (sprite: HTMLCanvasElement, x: number, y: number) =>
        context.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2)

      // Position des boules : interpolation entre deux images de la simulation.
      const position = Math.min(time * sim.frameRate, lastFrame)
      const index = Math.min(Math.floor(position), lastFrame - 1)
      const blend = position - index
      const from = sim.frames[index]
      const to = sim.frames[index + 1]
      const at = (k: number) => (from[k] + (to[k] - from[k]) * blend) * scale

      const zoom = Math.max(0, (time - zoomStart) / ZOOM_SECONDS)
      const eased = zoom * zoom * (3 - 2 * zoom)

      context.setTransform(1, 0, 0, 1, half, half)
      context.clearRect(-half, -half, size, size)

      context.globalAlpha = 1 - eased
      drawDrum(context, sim, time, scale)
      sprites.forEach((sprite, i) => {
        if (i !== winner) stamp(sprite, at(2 * i), at(2 * i + 1))
      })

      context.globalAlpha = 1
      if (zoom === 0) {
        stamp(time >= sim.exitTime ? winnerHalo : sprites[winner], at(2 * winner), at(2 * winner + 1))
      } else {
        // Pendant le zoom, la grande image de la boule est recopiée à la taille voulue.
        const extent = (radius + (half - radius) * eased) * (1 + PLAIN_PADDING)
        context.drawImage(
          winnerZoom,
          at(2 * winner) * (1 - eased) - extent,
          at(2 * winner + 1) * (1 - eased) - extent,
          2 * extent,
          2 * extent,
        )
      }

      request = requestAnimationFrame(render)
    }

    const stopSound = sounds ? playWheel(sim) : null
    request = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(request)
      stopSound?.()
    }
  }, [sim, sounds])

  return <canvas ref={canvasRef} className="wheel" role="img" aria-label="Tirage en cours" />
}
