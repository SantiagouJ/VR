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

function createAmbientMusic() {
  const sampleRate = audioContext.sampleRate;
  const duration = 30;
  const numSamples = sampleRate * duration;
  const buffer = audioContext.createBuffer(2, numSamples, sampleRate);
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const baseFreq = 55;
    let sample = 0;
    sample += Math.sin(2 * Math.PI * baseFreq * t) * 0.15;
    sample += Math.sin(2 * Math.PI * baseFreq * 1.5 * t) * 0.08;
    sample += Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.05;
    sample += Math.sin(2 * Math.PI * baseFreq * 3 * t) * 0.03;
    const lfoFreq = 0.05;
    const lfo = Math.sin(2 * Math.PI * lfoFreq * t) * 0.5 + 0.5;
    sample += Math.sin(2 * Math.PI * (baseFreq * 4) * t) * 0.02 * lfo;
    const pad1 = Math.sin(2 * Math.PI * 110 * t + Math.sin(2 * Math.PI * 0.1 * t) * 2) * 0.04;
    const pad2 = Math.sin(2 * Math.PI * 165 * t + Math.sin(2 * Math.PI * 0.08 * t) * 2) * 0.03;
    const pad3 = Math.sin(2 * Math.PI * 220 * t + Math.sin(2 * Math.PI * 0.12 * t) * 2) * 0.02;
    sample += pad1 + pad2 + pad3;
    const envelope = Math.min(1, t / 2) * Math.min(1, (duration - t) / 2);
    sample *= envelope * 0.5;
    const stereoOffset = Math.sin(2 * Math.PI * 0.03 * t) * 0.3;
    leftChannel[i] = sample * (1 - stereoOffset * 0.5);
    rightChannel[i] = sample * (1 + stereoOffset * 0.5);
  }
  return buffer;
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
