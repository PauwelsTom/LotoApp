const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

let unlocked = false

/**
 * À appeler pendant un appui de l'utilisateur : certains navigateurs (iOS)
 * refusent toute synthèse vocale qui n'a pas été amorcée par un geste.
 */
export function unlockSpeech(): void {
  if (!supported || unlocked) return
  unlocked = true
  const utterance = new SpeechSynthesisUtterance(' ')
  utterance.volume = 0
  speechSynthesis.speak(utterance)
}

export function speakNumber(n: number): void {
  if (!supported) return
  const utterance = new SpeechSynthesisUtterance(String(n))
  utterance.lang = 'fr-FR'
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'))
  if (voice) utterance.voice = voice
  utterance.rate = 0.9
  speechSynthesis.cancel()
  speechSynthesis.speak(utterance)
}

export function stopSpeech(): void {
  if (supported) speechSynthesis.cancel()
}
