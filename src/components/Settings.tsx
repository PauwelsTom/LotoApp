import { useState } from 'react'
import { isValidBallCount, MAX_BALLS, MIN_BALLS, type DrawAnimation, type Game } from '../lib/game'
import { playTick, setSoundVolume } from '../lib/sound'
import { speak } from '../lib/speech'
import { WHEEL_MAX_BALLS } from '../lib/wheel'
import { Confirm } from './Confirm'
import { Panel } from './Panel'

interface SettingsProps {
  game: Game
  onChangeMaxBalls: (maxBalls: number) => void
  onToggleVoice: (voice: boolean) => void
  onChangeSoundVolume: (volume: number) => void
  onChangeAnimation: (animation: DrawAnimation) => void
  onOpenQr: () => void
  onClose: () => void
}

const ANIMATIONS: { value: DrawAnimation; label: string; detail: string }[] = [
  { value: 'classic', label: 'Classique', detail: 'La boule tremble puis affiche le numéro.' },
  {
    value: 'wheel',
    label: 'Roue',
    detail: `Les boules tournent dans une roue et l'une d'elles sort par la trappe. Utilisée quand il reste moins de ${WHEEL_MAX_BALLS} boules.`,
  },
]

export function Settings({
  game,
  onChangeMaxBalls,
  onToggleVoice,
  onChangeSoundVolume,
  onChangeAnimation,
  onOpenQr,
  onClose,
}: SettingsProps) {
  const [value, setValue] = useState(String(game.maxBalls))
  const [confirming, setConfirming] = useState(false)

  const count = Number(value)
  const valid = value.trim() !== '' && isValidBallCount(count)
  const changed = valid && count !== game.maxBalls
  const percent = Math.round(game.soundVolume * 100)

  const apply = () => {
    if (!changed) return
    if (game.drawn.length > 0) setConfirming(true)
    else onChangeMaxBalls(count)
  }

  return (
    <Panel title="Paramètres" onClose={onClose}>
      <div className="settings">
        <form
          className="setting"
          onSubmit={(event) => {
            event.preventDefault()
            apply()
          }}
        >
          <label htmlFor="max-balls">Nombre de boules</label>
          <div className="setting-control">
            <input
              id="max-balls"
              type="number"
              inputMode="numeric"
              min={MIN_BALLS}
              max={MAX_BALLS}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <button type="submit" className="btn primary" disabled={!changed}>
              Appliquer
            </button>
          </div>
          {!valid && (
            <p className="notice error">
              Entre {MIN_BALLS} et {MAX_BALLS} boules.
            </p>
          )}
        </form>

        <div className="setting">
          <label className="toggle">
            <span>Annoncer les numéros à voix haute</span>
            <input
              type="checkbox"
              checked={game.voice}
              onChange={(event) => onToggleVoice(event.target.checked)}
            />
          </label>
          <label className="slider">
            <span>
              Volume des bruitages
              <output>{percent === 0 ? 'Coupé' : `${percent} %`}</output>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              onChange={(event) => {
                const volume = Number(event.target.value) / 100
                onChangeSoundVolume(volume)
                // Un cliquetis d'exemple, pour entendre le nouveau volume.
                setSoundVolume(volume)
                if (volume > 0) playTick()
              }}
            />
          </label>
          <button className="btn" onClick={() => speak('Test son')}>
            Test son
          </button>
        </div>

        <fieldset className="setting">
          <legend>Animation du tirage</legend>
          {ANIMATIONS.map(({ value, label, detail }) => (
            <label className="choice" key={value}>
              <input
                type="radio"
                name="animation"
                checked={game.animation === value}
                onChange={() => onChangeAnimation(value)}
              />
              <span>
                {label}
                <small>{detail}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="setting">
          <span>Grilles</span>
          <button className="btn" onClick={onOpenQr}>
            Générer un QR code pour une grille
          </button>
        </div>
      </div>

      {confirming && (
        <Confirm
          message={`Passer à ${count} boules remet le tirage en cours à zéro. Continuer ?`}
          confirmLabel="Changer et remettre à zéro"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onChangeMaxBalls(count)
          }}
        />
      )}
    </Panel>
  )
}
