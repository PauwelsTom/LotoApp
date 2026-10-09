import jsQR from 'jsqr'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { decodeCard, type Card } from '../lib/card'
import { Panel } from './Panel'

const MAX_SCAN_WIDTH = 640
const MAX_IMPORT_SIZE = 1024

interface ScannerProps {
  onResult: (card: Card) => void
  onCancel: () => void
}

export function Scanner({ onResult, onCancel }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(() =>
    navigator.mediaDevices
      ? null
      : "La caméra n'est pas disponible sur ce navigateur (une connexion HTTPS est nécessaire).",
  )
  const [hint, setHint] = useState('Placez le QR code de la grille dans le cadre')
  const emitResult = useEffectEvent(onResult)
  const [importError, setImportError] = useState<string | null>(null)

  // TEMPORAIRE : lit un QR code depuis un fichier image, pour tester sans caméra.
  const importFile = async (file: File) => {
    setImportError(null)
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, MAX_IMPORT_SIZE / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas indisponible')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(image.data, image.width, image.height)
      if (!code) {
        setImportError('Aucun QR code trouvé dans cette image.')
        return
      }
      const card = decodeCard(code.data)
      if (card) onResult(card)
      else setImportError("Ce QR code n'est pas une grille de loto.")
    } catch {
      setImportError("Impossible de lire ce fichier comme une image.")
    }
  }

  useEffect(() => {
    const video = videoRef.current
    // Sans caméra disponible, la vidéo n'est pas affichée et il n'y a rien à démarrer.
    if (!video) return

    let stream: MediaStream | null = null
    let frame = 0
    let cancelled = false
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    const scan = () => {
      if (cancelled) return
      if (context && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height)
        if (code) {
          const card = decodeCard(code.data)
          if (card) {
            emitResult(card)
            return
          }
          setHint("Ce QR code n'est pas une grille de loto")
        }
      }
      frame = requestAnimationFrame(scan)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop())
          return
        }
        stream = s
        video.srcObject = s
        void video.play().catch(() => {})
        scan()
      })
      .catch(() => {
        setError("Impossible d'accéder à la caméra. Vérifiez l'autorisation dans le navigateur.")
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <Panel title="Scanner une grille" closeLabel="Annuler" onClose={onCancel}>
      <div className="scanner">
        {error ? (
          <p className="notice error">{error}</p>
        ) : (
          <>
            <div className="scanner-view">
              <video ref={videoRef} playsInline muted />
              <div className="scanner-frame" />
            </div>
            <p className="notice">{hint}</p>
          </>
        )}
        {/* TEMPORAIRE : import d'un QR code depuis un fichier */}
        <label className="btn scanner-import">
          Importer une image (test)
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void importFile(file)
            }}
          />
        </label>
        {importError && <p className="notice error">{importError}</p>}
      </div>
    </Panel>
  )
}
