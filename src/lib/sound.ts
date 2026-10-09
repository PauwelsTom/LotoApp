import type { WheelSim } from './wheel'

/** Bruitages du tirage, synthétisés par le navigateur : aucun fichier audio à charger. */

/** Gain appliqué quand le curseur de volume est à fond. */
const MAX_GAIN = 2

let context: AudioContext | null = null
let master: GainNode | null = null
let volume = 0.5

/** Renvoie la sortie commune à tous les bruitages, réglée au volume choisi. */
function getOutput(): GainNode | null {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    if (!master) {
      master = context.createGain()
      master.connect(context.destination)
    }
    master.gain.value = volume * MAX_GAIN
    return master
  } catch {
    return null
  }
}

/**
 * Règle le volume des bruitages, de 0 (muet) à 1 (maximum). À appeler pendant un appui de
 * l'utilisateur : les navigateurs bloquent le son tant qu'il n'y a pas eu de geste.
 */
export function setSoundVolume(value: number): void {
  volume = Math.min(1, Math.max(0, value))
  getOutput()
}

let noise: AudioBuffer | null = null

/** Un court échantillon de bruit blanc, matière première de tous les chocs. */
function noiseBuffer(audio: AudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== audio.sampleRate) {
    noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.25), audio.sampleRate)
    const samples = noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  }
  return noise
}

/**
 * Un choc sec : une bouffée de bruit filtrée autour d'une fréquence, qui s'éteint aussitôt.
 * Une fréquence haute donne un « clic », une fréquence basse un « toc ».
 */
function knock(
  audio: AudioContext,
  output: AudioNode,
  time: number,
  options: { frequency: number; volume: number; seconds: number },
) {
  const source = audio.createBufferSource()
  const filter = audio.createBiquadFilter()
  const gain = audio.createGain()
  source.buffer = noiseBuffer(audio)
  filter.type = 'bandpass'
  filter.frequency.value = options.frequency
  filter.Q.value = 1.2
  gain.gain.setValueAtTime(options.volume, time)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + options.seconds)
  source.connect(filter).connect(gain).connect(output)
  // Chaque choc démarre à un endroit différent de l'échantillon, pour ne pas se répéter.
  source.start(time, Math.random() * 0.1, options.seconds)
}

/** Animation classique : un cliquetis à chaque numéro qui défile. */
export function playTick(): void {
  const master = getOutput()
  if (!master) return
  const audio = master.context as AudioContext
  knock(audio, master, audio.currentTime, {
    frequency: 3200 + Math.random() * 800,
    volume: 0.5,
    seconds: 0.03,
  })
}

/**
 * Animation de la roue : un choc à chaque collision de la simulation, puis un coup plus lourd
 * quand la boule sort par la trappe. Renvoie une fonction qui coupe le son.
 */
export function playWheel(sim: WheelSim): () => void {
  const master = getOutput()
  if (!master) return () => {}
  const audio = master.context as AudioContext
  const output = audio.createGain()
  output.connect(master)
  const start = audio.currentTime + 0.02

  for (const impact of sim.impacts) {
    knock(audio, output, start + impact.time, {
      // Les chocs contre la paroi sont plus sourds que les chocs entre boules.
      frequency: (impact.wall ? 900 : 2600) * (0.8 + Math.random() * 0.4),
      volume: 0.25 + 0.75 * impact.strength,
      seconds: impact.wall ? 0.07 : 0.04,
    })
  }
  // La sortie de la boule : un claquement suivi d'un coup grave.
  knock(audio, output, start + sim.exitTime, { frequency: 1800, volume: 1.4, seconds: 0.06 })
  knock(audio, output, start + sim.exitTime + 0.01, { frequency: 260, volume: 2.2, seconds: 0.2 })

  return () => output.disconnect()
}
