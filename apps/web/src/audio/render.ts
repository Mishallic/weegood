import { midiToHz, type LoopPlan, type Note } from './plan';

/**
 * Render a loop plan to an AudioBuffer with an OfflineAudioContext. A few bars at 44.1 kHz take
 * well under 100 ms to render, so this runs on demand when a demo track starts.
 */
export async function renderLoop(plan: LoopPlan, sampleRate: number): Promise<AudioBuffer> {
  const length = Math.ceil(plan.loopSeconds * sampleRate);
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  const master = ctx.createGain();
  master.gain.value = 0.9;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 4;
  master.connect(compressor).connect(ctx.destination);

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = plan.cutoffHz;
  tone.Q.value = 0.7;
  tone.connect(master);

  const noise = createNoiseBuffer(ctx, 1);

  for (const note of plan.pad) {
    for (const detune of [-6, 6]) {
      playNote(ctx, tone, note, plan.padWave, plan.padGain * 0.5, detune, 0.08, 0.3);
    }
  }
  for (const note of plan.bass) {
    playNote(ctx, tone, note, plan.bassWave, plan.bassGain, 0, 0.005, 0.08);
  }
  for (const note of plan.lead) {
    playNote(ctx, master, note, plan.leadWave, plan.leadGain, 0, 0.01, 0.12);
  }
  for (const hit of plan.kicks) playKick(ctx, master, hit.time, plan.kickGain * hit.velocity);
  for (const hit of plan.hats) {
    playNoise(ctx, master, noise, hit.time, 0.035, 'highpass', 7000, plan.hatGain * hit.velocity);
  }
  for (const hit of plan.snares) {
    playNoise(ctx, master, noise, hit.time, 0.14, 'bandpass', 1800, plan.snareGain * hit.velocity);
  }

  return ctx.startRendering();
}

function playNote(
  ctx: OfflineAudioContext,
  destination: AudioNode,
  note: Note,
  wave: OscillatorType,
  gainValue: number,
  detuneCents: number,
  attack: number,
  release: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.value = midiToHz(note.midi);
  osc.detune.value = detuneCents;

  const gain = ctx.createGain();
  const peak = gainValue * note.velocity;
  const start = note.time;
  const end = Math.min(note.time + note.duration, ctx.length / ctx.sampleRate);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, Math.max(start + attack, end - release));
  gain.gain.linearRampToValueAtTime(0, end);

  osc.connect(gain).connect(destination);
  osc.start(start);
  osc.stop(end + 0.01);
}

function playKick(ctx: BaseAudioContext, destination: AudioNode, time: number, gainValue: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
  osc.connect(gain).connect(destination);
  osc.start(time);
  osc.stop(time + 0.35);
}

function playNoise(
  ctx: BaseAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  time: number,
  duration: number,
  filterType: BiquadFilterType,
  frequency: number,
  gainValue: number,
) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(time, 0, duration + 0.02);
}

function createNoiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic noise: a tiny LCG so renders are identical run to run.
  let state = 0x2545f491;
  for (let i = 0; i < data.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = (state / 4294967296) * 2 - 1;
  }
  return buffer;
}
