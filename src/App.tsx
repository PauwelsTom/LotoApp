import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Confirm } from './components/Confirm'
import { QrGenerator } from './components/QrGenerator'
import { Scanner } from './components/Scanner'
import { Settings } from './components/Settings'
import { Verify } from './components/Verify'
import { WheelDraw } from './components/WheelDraw'
import { missingNumbers, type Card } from './lib/card'
import { celebrate } from './lib/confetti'
import { loadGame, pickRandom, remainingBalls, saveGame } from './lib/game'
import { speakNumber, stopSpeech, unlockSpeech } from './lib/speech'
import { useWakeLock } from './lib/useWakeLock'
import { simulateWheel, WHEEL_MAX_BALLS, type WheelSim } from './lib/wheel'

type View = 'draw' | 'verify' | 'scan' | 'settings' | 'qr'

const ROLL_DURATION_MS = 1600
const ROLL_TICK_MS = 80
const HISTORY_SIZE = 20

export default function App() {
  const [game, setGame] = useState(loadGame)
  const [view, setView] = useState<View>('draw')
  const [rollValue, setRollValue] = useState<number | null>(null)
  const [wheel, setWheel] = useState<WheelSim | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [card, setCard] = useState<Card | null>(null)
  const timers = useRef<{ tick?: number; end?: number }>({})

  useWakeLock()

  useEffect(() => saveGame(game), [game])

  useEffect(() => {
    const pending = timers.current
    return () => {
      window.clearInterval(pending.tick)
      window.clearTimeout(pending.end)
    }
  }, [])

  const { drawn, maxBalls, voice, marked } = game
  const rolling = rollValue !== null || wheel !== null
  const finished = drawn.length >= maxBalls
  const current = rollValue ?? drawn.at(-1)
  const history = drawn.slice(0, -1).reverse().slice(0, HISTORY_SIZE)

  const reveal = (number: number) => {
    if (voice) speakNumber(number)
    if (marked.includes(number)) celebrate()
  }

  const draw = () => {
    if (rolling || finished || timers.current.end !== undefined) return
    const remaining = remainingBalls(game)
    if (voice) unlockSpeech()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (game.animation === 'wheel' && remaining.length < WHEEL_MAX_BALLS && !reducedMotion) {
      const sim = simulateWheel(remaining)
      if (sim) {
        setGame({ ...game, drawn: [...drawn, sim.numbers[sim.winner]] })
        setWheel(sim)
        return
      }
    }

    const number = pickRandom(remaining)
    // Le numéro est enregistré tout de suite : un rechargement pendant l'animation ne le perd pas.
    setGame({ ...game, drawn: [...drawn, number] })
    setRollValue(pickRandom(remaining))
    timers.current.tick = window.setInterval(() => {
      setRollValue(1 + Math.floor(Math.random() * maxBalls))
    }, ROLL_TICK_MS)
    timers.current.end = window.setTimeout(() => {
      window.clearInterval(timers.current.tick)
      timers.current = {}
      setRollValue(null)
      reveal(number)
    }, ROLL_DURATION_MS)
  }

  const reset = () => {
    stopSpeech()
    setCard(null)
    setGame({ ...game, drawn: [], marked: [] })
    setConfirmReset(false)
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.code !== 'Space' || view !== 'draw' || confirmReset) return
    event.preventDefault()
    draw()
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const showCard = (scanned: Card) => {
    setCard(scanned)
    setView('verify')
    if (missingNumbers(scanned, drawn).length === 0) celebrate()
  }

  return (
    <>
      <main className="app">
        <div className="history" aria-label="Derniers numéros sortis">
          <span className="history-label">Derniers numéros</span>
          {history.length === 0 && <span className="history-empty">—</span>}
          {history.map((n) => (
            <span className={marked.includes(n) ? 'chip lucky' : 'chip'} key={n}>
              {n}
            </span>
          ))}
        </div>

        <div className="stage">
          {wheel && (
            <WheelDraw
              sim={wheel}
              marked={marked}
              onDone={() => {
                setWheel(null)
                reveal(wheel.numbers[wheel.winner])
              }}
            />
          )}
          <button
            hidden={wheel !== null}
            className={
              rolling ? 'ball rolling' : current !== undefined && marked.includes(current) ? 'ball lucky' : 'ball'
            }
            onClick={draw}
            aria-label={finished ? 'Tirage terminé' : 'Tirer une boule'}
          >
            {current === undefined ? (
              <span className="ball-hint">Touchez pour tirer</span>
            ) : (
              <span
                className={current >= 100 ? 'ball-number long' : 'ball-number'}
                key={rolling ? 'rolling' : current}
              >
                {current}
              </span>
            )}
          </button>
          <span className="counter">
            {finished ? 'Tirage terminé' : `${drawn.length} / ${maxBalls}`}
          </span>
        </div>

        <nav className="actions">
          <button
            className="btn danger"
            onClick={() => setConfirmReset(true)}
            disabled={rolling || drawn.length === 0}
          >
            Reset
          </button>
          <button className="btn primary" onClick={() => setView('verify')} disabled={rolling}>
            Vérification
          </button>
          <button className="btn" onClick={() => setView('settings')} disabled={rolling}>
            Paramètres
          </button>
        </nav>
      </main>

      {view === 'verify' && (
        <Verify
          game={game}
          card={card}
          onScan={() => setView('scan')}
          onClearCard={() => setCard(null)}
          onToggleMark={(n) =>
            setGame({
              ...game,
              marked: marked.includes(n) ? marked.filter((m) => m !== n) : [...marked, n],
            })
          }
          onClose={() => setView('draw')}
        />
      )}
      {view === 'scan' && <Scanner onResult={showCard} onCancel={() => setView('verify')} />}
      {view === 'settings' && (
        <Settings
          game={game}
          onChangeMaxBalls={(count) => {
            stopSpeech()
            setCard(null)
            setGame({ ...game, maxBalls: count, drawn: [], marked: [] })
          }}
          onToggleVoice={(enabled) => setGame({ ...game, voice: enabled })}
          onChangeAnimation={(animation) => setGame({ ...game, animation })}
          onOpenQr={() => setView('qr')}
          onClose={() => setView('draw')}
        />
      )}
      {view === 'qr' && <QrGenerator maxBalls={maxBalls} onClose={() => setView('settings')} />}

      {confirmReset && (
        <Confirm
          message={`Remettre le tirage à zéro ? Les ${drawn.length} numéros sortis seront effacés.`}
          confirmLabel="Remettre à zéro"
          onCancel={() => setConfirmReset(false)}
          onConfirm={reset}
        />
      )}
    </>
  )
}
