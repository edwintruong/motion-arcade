/** Every sound is synthesised, so the game ships no audio files. */
let ctx: AudioContext | undefined;

/** Browsers only allow sound after the user has touched the page. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
}

function tone(freq: number, ms: number, type: OscillatorType, gain: number, slideTo?: number) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + ms / 1000);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000);
}

export const sounds = {
  swoosh: (power: number) => tone(500 + 500 * power, 140, "sawtooth", 0.05, 160),
  hit: (power: number) => tone(700 + 500 * power, 70, "square", 0.18, 260),
  bounce: () => tone(240, 60, "sine", 0.2, 110),
  net: () => tone(130, 180, "triangle", 0.2, 70),
  point: () => (tone(660, 120, "triangle", 0.15), setTimeout(() => tone(880, 200, "triangle", 0.15), 110)),
  fault: () => tone(220, 300, "sawtooth", 0.08, 110),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 260, "triangle", 0.16), i * 140)),
};
