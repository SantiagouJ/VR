import { state } from '../state.js';

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let ambientGainNode = null;
let uiGainNode = null;
let ambientSource = null;
let ambientBuffer = null;
let uiSelectBuffer = null;
let uiCloseBuffer = null;
let audioInitialized = false;
let ambientPlaying = false;

export const DEFAULT_AMBIENT_VOLUME = 0.3;
export const VR_AMBIENT_VOLUME = 1;
export const DEFAULT_UI_VOLUME = 0.5;

export async function unlockAudioContext() {
  try {
    if (audioContext.state !== 'running') await audioContext.resume();
  } catch (err) {
    console.warn('No se pudo reanudar AudioContext:', err);
  }
  if (!audioInitialized) initAudio();
  return audioContext.state === 'running';
}

export function ensureAudioFromXRGesture() {
  unlockAudioContext().then((ok) => {
    if (!ok) return;
    if (state.isInVR && state.loadedModel && !ambientPlaying) {
      playAmbientMusic();
      setAmbientMixForVR(true);
    }
  });
}

// Elevator/lounge music: Cmaj7 → Am7 → Fmaj7 → G7 (7.5s each, 30s loop)
// Bass + warm pad chords + vibraphone melody + subtle hi-hats + reverb
function createAmbientMusic() {
  const SR = audioContext.sampleRate;
  const DUR = 30;
  const N = SR * DUR;
  const buf = audioContext.createBuffer(2, N, SR);
  const dry = new Float32Array(N);

  // Each chord: { bass Hz, pad tones Hz[], melody notes Hz[] }
  const SEC = 7.5;
  const chords = [
    { b: 65.41,  p: [261.63, 329.63, 392.00, 493.88], m: [659.25, 587.33, 523.25, 392.00] }, // Cmaj7
    { b: 55.00,  p: [220.00, 261.63, 329.63, 392.00], m: [440.00, 523.25, 493.88, 440.00] }, // Am7
    { b: 87.31,  p: [349.23, 440.00, 523.25, 329.63], m: [349.23, 392.00, 440.00, 523.25] }, // Fmaj7
    { b: 98.00,  p: [392.00, 493.88, 587.33, 349.23], m: [587.33, 493.88, 392.00, 587.33] }, // G7
  ];

  const MNOTE = SEC / 4;  // 1.875s per melody note
  const BEAT  = 0.75;     // 80 BPM

  for (let i = 0; i < N; i++) {
    const t   = i / SR;
    const sec = Math.min(3, Math.floor(t / SEC));
    const ch  = chords[sec];
    const tS  = t - sec * SEC;

    // Smooth blend at chord boundaries
    const XF = 0.5;
    let blend = 1.0;
    if (tS < XF) blend = tS / XF;
    else if (sec < 3 && tS > SEC - XF) blend = (SEC - tS) / XF;

    let s = 0;

    // Bass — fundamental + octave, soft swell
    const bEnv = Math.min(1, tS * 2.5) * blend;
    s += Math.sin(2 * Math.PI * ch.b * t) * 0.14 * bEnv;
    s += Math.sin(2 * Math.PI * ch.b * 2 * t) * 0.04 * bEnv;

    // Pads — warm, slightly chorused
    const pEnv = Math.min(1, tS * 1.2) * blend;
    for (const f of ch.p) {
      s += Math.sin(2 * Math.PI * f * t) * 0.026 * pEnv;
      s += Math.sin(2 * Math.PI * f * 1.0035 * t) * 0.013 * pEnv;
    }

    // Melody — vibraphone: fast decay, 4th harmonic, subtle pitch vibrato
    const mIdx  = Math.min(3, Math.floor(tS / MNOTE));
    const tN    = tS - mIdx * MNOTE;
    const vib   = 1 + Math.sin(2 * Math.PI * 5.5 * t) * 0.003;
    const mEnv  = Math.min(1, tN / 0.025) * Math.exp(-tN * 2.0) * blend;
    const mf    = ch.m[mIdx] * vib;
    s += Math.sin(2 * Math.PI * mf * t) * 0.09 * mEnv;
    s += Math.sin(2 * Math.PI * mf * 4 * t) * 0.022 * mEnv; // metallic 4th harmonic

    // Hi-hats — on-beat and lighter off-beat
    const tB  = t % BEAT;
    s += (Math.random() * 2 - 1) * Math.exp(-tB * 600) * 0.022 * blend;
    const tBo = (t + BEAT * 0.5) % BEAT;
    s += (Math.random() * 2 - 1) * Math.exp(-tBo * 900) * 0.010 * blend;

    // Global fade in/out for seamless loop
    s *= Math.min(1, t) * Math.min(1, DUR - t);

    dry[i] = s;
  }

  // Multi-tap reverb (reads only from dry, no feedback)
  const taps = [
    { d: Math.floor(0.06 * SR), g: 0.22 },
    { d: Math.floor(0.13 * SR), g: 0.13 },
    { d: Math.floor(0.22 * SR), g: 0.07 },
  ];
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  for (let i = 0; i < N; i++) {
    let w = dry[i];
    for (const tap of taps) {
      if (i >= tap.d) w += dry[i - tap.d] * tap.g;
    }
    const pan = Math.sin(2 * Math.PI * 0.05 * (i / SR)) * 0.18;
    L[i] = Math.max(-1, Math.min(1, w * (1 - pan)));
    R[i] = Math.max(-1, Math.min(1, w * (1 + pan)));
  }

  return buf;
}

function createUISelectSound() {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.24;
  const numSamples = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 14) * Math.min(1, t * 130);
    let sample = 0;
    sample += Math.sin(2 * Math.PI * 980 * t) * 0.28;
    sample += Math.sin(2 * Math.PI * 1480 * t) * 0.2;
    sample += Math.sin(2 * Math.PI * 1980 * t) * 0.1;
    const sweep = 940 + (1 - Math.exp(-t * 24)) * 360;
    sample += Math.sin(2 * Math.PI * sweep * t) * 0.22;
    channel[i] = sample * envelope * 0.4;
  }
  return buffer;
}

function createUICloseSound() {
  const sampleRate = audioContext.sampleRate;
  const duration = 0.2;
  const numSamples = sampleRate * duration;
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 16) * Math.min(1, t * 150);
    const downSweep = 720 - (1 - Math.exp(-t * 18)) * 420;
    let sample = 0;
    sample += Math.sin(2 * Math.PI * downSweep * t) * 0.34;
    sample += Math.sin(2 * Math.PI * (downSweep * 0.5) * t) * 0.18;
    channel[i] = sample * envelope * 0.36;
  }
  return buffer;
}

export function initAudio() {
  if (audioInitialized) return;
  if (audioContext.state === 'suspended') audioContext.resume();
  ambientGainNode = audioContext.createGain();
  ambientGainNode.gain.value = DEFAULT_AMBIENT_VOLUME;
  ambientGainNode.connect(audioContext.destination);
  uiGainNode = audioContext.createGain();
  uiGainNode.gain.value = DEFAULT_UI_VOLUME;
  uiGainNode.connect(audioContext.destination);
  ambientBuffer = createAmbientMusic();
  uiSelectBuffer = createUISelectSound();
  uiCloseBuffer = createUICloseSound();
  audioInitialized = true;
}

export function playAmbientMusic() {
  if (!audioInitialized) initAudio();
  if (ambientPlaying) return;
  ambientSource = audioContext.createBufferSource();
  ambientSource.buffer = ambientBuffer;
  ambientSource.loop = true;
  ambientSource.connect(ambientGainNode);
  ambientSource.start();
  ambientPlaying = true;
}

export function stopAmbientMusic() {
  if (ambientSource && ambientPlaying) {
    ambientSource.stop();
    ambientPlaying = false;
  }
}

function playUIBuffer(buffer) {
  if (!audioInitialized) initAudio();
  if (!buffer) return;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(uiGainNode);
  source.start();
}

export function playUISelectSound() { playUIBuffer(uiSelectBuffer); }
export function playUICloseSound() { playUIBuffer(uiCloseBuffer); }

export function setAmbientMixForVR(enabled) {
  if (!audioInitialized || !ambientGainNode) return;
  const target = enabled ? VR_AMBIENT_VOLUME : DEFAULT_AMBIENT_VOLUME;
  const now = audioContext.currentTime;
  ambientGainNode.gain.cancelScheduledValues(now);
  ambientGainNode.gain.setTargetAtTime(target, now, 0.2);
}

export function setAmbientVolume(volume) {
  if (ambientGainNode) ambientGainNode.gain.value = Math.max(0, Math.min(1, volume));
}

export function setUIVolume(volume) {
  if (uiGainNode) uiGainNode.gain.value = Math.max(0, Math.min(1, volume));
}

document.addEventListener('click', () => unlockAudioContext(), { once: true });
document.addEventListener('touchstart', () => unlockAudioContext(), { once: true });
