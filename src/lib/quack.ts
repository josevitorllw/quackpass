/** Som de "quack" sintetizado no navegador (Web Audio): não precisa de arquivo de áudio. Só rodar no cliente. */

export function createAudio(): AudioContext | null {
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try {
    return new C();
  } catch {
    return null;
  }
}

/** Um "quack": serra que cai de tom, passa por filtros nasais e tem um "ruído" de 75 Hz que dá a voz de pato. */
function quackAt(ctx: AudioContext, when: number, volume: number, pitch: number) {
  const dur = 0.24;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(640 * pitch, when);
  osc.frequency.exponentialRampToValueAtTime(340 * pitch, when + 0.09);
  osc.frequency.exponentialRampToValueAtTime(250 * pitch, when + dur);

  const f1 = ctx.createBiquadFilter();
  f1.type = "bandpass";
  f1.frequency.value = 900 * pitch;
  f1.Q.value = 3;
  const f2 = ctx.createBiquadFilter();
  f2.type = "bandpass";
  f2.frequency.value = 2200 * pitch;
  f2.Q.value = 4;
  const g2 = ctx.createGain();
  g2.gain.value = 0.5;

  const buzz = ctx.createGain();
  buzz.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 75;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.4;
  lfo.connect(lfoDepth);
  lfoDepth.connect(buzz.gain);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(volume, when + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  osc.connect(f1);
  osc.connect(f2);
  f1.connect(buzz);
  f2.connect(g2);
  g2.connect(buzz);
  buzz.connect(env);
  env.connect(ctx.destination);

  osc.start(when);
  lfo.start(when);
  osc.stop(when + dur + 0.02);
  lfo.stop(when + dur + 0.02);
}

/** "Quack, quack, quack!" (combina com as três bicadas da animação). `when` é em segundos no relógio do contexto. */
export function quackQuack(ctx: AudioContext, when: number) {
  quackAt(ctx, when, 0.9, 1);
  quackAt(ctx, when + 0.3, 0.65, 1.07);
  quackAt(ctx, when + 0.58, 0.5, 0.95);
}
