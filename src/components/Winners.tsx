import { remainingBalls, type Game } from '../lib/game'
import { Panel } from './Panel'

interface WinnersProps {
  game: Game
  onToggle: (n: number) => void
  onClose: () => void
}

export function Winners({ game, onToggle, onClose }: WinnersProps) {
  const remaining = remainingBalls(game)
  const marked = new Set(game.marked)
  const selected = remaining.filter((n) => marked.has(n)).length

  return (
    <Panel
      title="Numéros gagnants"
      subtitle={`${selected} sélectionné${selected > 1 ? 's' : ''} sur ${remaining.length} restants`}
      onClose={onClose}
    >
      {remaining.length === 0 ? (
        <p className="notice">Tous les numéros sont sortis.</p>
      ) : (
        <>
          <p className="notice pick-hint">
            Touchez les numéros gagnants : leur boule sera verte et leur tirage fêté.
          </p>
          <div className="pickgrid">
            {remaining.map((n) => (
              <button
                className={marked.has(n) ? 'num marked' : 'num'}
                key={n}
                aria-pressed={marked.has(n)}
                onClick={() => onToggle(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
