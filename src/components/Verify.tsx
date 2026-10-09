import { missingNumbers, type Card } from '../lib/card'
import type { Game } from '../lib/game'
import { Panel } from './Panel'

interface VerifyProps {
  game: Game
  card: Card | null
  onScan: () => void
  onClearCard: () => void
  onToggleMark: (n: number) => void
  onClose: () => void
}

const COLUMN_SIZE = 10

function CardResult({ card, game, onClear }: { card: Card; game: Game; onClear: () => void }) {
  const drawn = new Set(game.drawn)
  const numbers = card.flat().sort((a, b) => a - b)
  const missing = missingNumbers(card, drawn).length
  const columnCount = Math.ceil(Math.max(game.maxBalls, ...numbers) / COLUMN_SIZE)
  const columns = Array.from({ length: columnCount }, (_, i) =>
    numbers.filter((n) => Math.floor((n - 1) / COLUMN_SIZE) === i),
  )

  return (
    <div className="card-result">
      <div className="card-result-head">
        <strong className={missing === 0 ? 'verdict win' : 'verdict'}>
          {missing === 0
            ? 'Carton plein !'
            : `Il manque ${missing} numéro${missing > 1 ? 's' : ''}`}
        </strong>
        <button className="btn small" onClick={onClear}>
          Effacer
        </button>
      </div>
      <div className="card-columns">
        {columns.map((column, i) => (
          <div className="card-column" key={i}>
            <span className="card-column-label">
              {i * COLUMN_SIZE + 1}-{(i + 1) * COLUMN_SIZE}
            </span>
            {column.map((n) => (
              <span className={drawn.has(n) ? 'num hit' : 'num miss'} key={n}>
                {n}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Verify({ game, card, onScan, onClearCard, onToggleMark, onClose }: VerifyProps) {
  const drawn = new Set(game.drawn)
  const marked = new Set(game.marked)
  const numbers = Array.from({ length: game.maxBalls }, (_, i) => i + 1)

  return (
    <Panel
      title="Vérification"
      subtitle={`${game.drawn.length} / ${game.maxBalls} sortis`}
      onClose={onClose}
      action={
        <button className="btn primary" onClick={onScan}>
          Scanner
        </button>
      }
    >
      {card && <CardResult card={card} game={game} onClear={onClearCard} />}
      <div className="numgrid">
        {numbers.map((n) => (
          <button
            className={['num', drawn.has(n) && 'on', marked.has(n) && 'marked'].filter(Boolean).join(' ')}
            key={n}
            disabled={drawn.has(n)}
            aria-pressed={marked.has(n)}
            onClick={() => onToggleMark(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="numgrid-hint">
        Touchez un numéro pas encore sorti pour l'attendre : sa boule sera verte.
      </p>
    </Panel>
  )
}
