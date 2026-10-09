import { useEffect } from 'react'

/** Empêche l'écran de se mettre en veille tant que l'application est visible. */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (cancelled) void sentinel.release()
          else lock = sentinel
        })
        .catch(() => {
          // Refusé (batterie faible, etc.) : sans conséquence pour le jeu.
        })
    }

    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [])
}
