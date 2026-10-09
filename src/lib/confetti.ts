import confetti from 'canvas-confetti'

const DURATION_MS = 2500
const BURST_INTERVAL_MS = 250
const COLORS = ['#ffc93c', '#3ed07a', '#ff7676', '#6cb6ff', '#ffffff']

/** Lance des confettis depuis les deux côtés de l'écran pendant quelques secondes. */
export function celebrate(): void {
  const end = Date.now() + DURATION_MS
  const burst = () => {
    for (const x of [0, 1]) {
      void confetti({
        particleCount: 45,
        angle: x === 0 ? 60 : 120,
        spread: 70,
        startVelocity: 55,
        origin: { x, y: 0.7 },
        colors: COLORS,
        disableForReducedMotion: true,
      })
    }
    if (Date.now() < end) window.setTimeout(burst, BURST_INTERVAL_MS)
  }
  burst()
}
