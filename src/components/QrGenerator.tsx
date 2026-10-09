import QRCode from 'qrcode'
import { useState } from 'react'
import { CARD_COLS, CARD_ROWS, encodeCard, type Card } from '../lib/card'
import { Panel } from './Panel'

interface QrGeneratorProps {
  maxBalls: number
  onClose: () => void
}

const emptyGrid = () => Array.from({ length: CARD_ROWS }, () => Array<string>(CARD_COLS).fill(''))

function parseGrid(grid: string[][], maxBalls: number): { card: Card } | { error: string } {
  const cells = grid.flat()
  if (cells.some((cell) => cell.trim() === '')) {
    return { error: `Remplissez les ${CARD_ROWS * CARD_COLS} cases.` }
  }
  const card = grid.map((row) => row.map(Number))
  const numbers = card.flat()
  const invalid = numbers.find((n) => !Number.isInteger(n) || n < 1 || n > maxBalls)
  if (invalid !== undefined) {
    return { error: `Les numéros doivent être compris entre 1 et ${maxBalls}.` }
  }
  const duplicate = numbers.find((n, i) => numbers.indexOf(n) !== i)
  if (duplicate !== undefined) {
    return { error: `Le numéro ${duplicate} est saisi plusieurs fois.` }
  }
  return { card }
}

export function QrGenerator({ maxBalls, onClose }: QrGeneratorProps) {
  const [grid, setGrid] = useState(emptyGrid)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<{ url: string; card: Card } | null>(null)

  const setCell = (row: number, col: number, value: string) => {
    setGrid(grid.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r)))
    setQr(null)
    setError(null)
  }

  const generate = async () => {
    const parsed = parseGrid(grid, maxBalls)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    try {
      const url = await QRCode.toDataURL(encodeCard(parsed.card), {
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setQr({ url, card: parsed.card })
    } catch {
      setError('La génération du QR code a échoué.')
    }
  }

  const clear = () => {
    setGrid(emptyGrid())
    setQr(null)
    setError(null)
  }

  return (
    <Panel title="QR code d'une grille" closeLabel="Retour" onClose={onClose}>
      <div className="qr-layout">
        <form
          className="qr-form"
          onSubmit={(event) => {
            event.preventDefault()
            void generate()
          }}
        >
          <p className="notice">Saisissez les numéros de la grille, ligne par ligne.</p>
          {grid.map((row, i) => (
            <div className="qr-row" key={i}>
              {row.map((cell, j) => (
                <input
                  key={j}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxBalls}
                  value={cell}
                  aria-label={`Ligne ${i + 1}, numéro ${j + 1}`}
                  onChange={(event) => setCell(i, j, event.target.value)}
                />
              ))}
            </div>
          ))}
          {error && <p className="notice error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={clear}>
              Vider
            </button>
            <button type="submit" className="btn primary">
              Générer le QR code
            </button>
          </div>
        </form>

        {qr && (
          <div className="qr-output">
            <div className="print-area">
              <img src={qr.url} alt="QR code de la grille" />
              <p>{qr.card.map((row) => row.join(' · ')).join('\n')}</p>
            </div>
            <div className="dialog-actions">
              <a className="btn" href={qr.url} download={`grille-${qr.card[0].join('-')}.png`}>
                Télécharger
              </a>
              <button className="btn" onClick={() => window.print()}>
                Imprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
