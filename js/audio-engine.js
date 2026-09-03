// Web Audio Engine: Timing scheduler and click synthesizer
// Pure procedural implementation using Web Audio API

let audioCtx = null;
let isPlaying = false;
let currentTempo = 120;
let beatsPerMeasure = 4;
let currentBeatInMeasure = 0;

// Lookahead scheduling constants (in seconds)
const LOOKAHEAD_INTERVAL_MS = 25.0; // How frequently scheduler timer fires
const SCHEDULE_AHEAD_TIME_SEC = 0.1; // How far ahead to schedule audio

let nextNoteTime = 0.0;
let timerId = null;
let isAudioMuted = false;
let currentSoundType = "beep"; // "beep" (default), "voice", "drumkit", "woodblock", "cowbell", "mechanical", "rimshot", "silent"
let noiseBuffer = null;

// Preloaded studio AudioBuffers for human voice count (Female & Male)
const voiceFemaleAudioBuffers = [];
const voiceMaleAudioBuffers = [];
let isVoicePreloading = false;

function base64ToArrayBuffer(base64DataUri) {
  const parts = base64DataUri.split(",");
  const base64 = parts.length > 1 ? parts[1] : parts[0];
  const binaryString = (typeof window !== "undefined" && window.atob) ? window.atob(base64) : (typeof Buffer !== "undefined" ? Buffer.from(base64, "base64").toString("binary") : "");
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decodeSingleVoiceSample(ctx, uri) {
  const arrayBuf = base64ToArrayBuffer(uri);
  return new Promise(function (resolve, reject) {
    const res = ctx.decodeAudioData(arrayBuf, resolve, reject);
    if (res && typeof res.then === "function") {
      res.then(resolve).catch(reject);
    }
  });
}

async function preloadVoiceBuffers(ctx) {
  if (isVoicePreloading || !ctx || typeof ctx.decodeAudioData !== "function") {
    return;
  }
  isVoicePreloading = true;

  // 1. Preload Female voice samples (Microsoft Zira Desktop)
  if (typeof VOICE_FEMALE_SAMPLE_URIS !== "undefined" && voiceFemaleAudioBuffers.length === 0) {
    for (let i = 0; i < VOICE_FEMALE_SAMPLE_URIS.length; i++) {
      try {
        const audioBuf = await decodeSingleVoiceSample(ctx, VOICE_FEMALE_SAMPLE_URIS[i]);
        voiceFemaleAudioBuffers[i] = audioBuf;
      } catch (err) {
        console.warn("Could not decode female voice sample", i, err);
      }
    }
  }

  // 2. Preload Male voice samples (Microsoft David Desktop)
  if (typeof VOICE_MALE_SAMPLE_URIS !== "undefined" && voiceMaleAudioBuffers.length === 0) {
    for (let i = 0; i < VOICE_MALE_SAMPLE_URIS.length; i++) {
      try {
        const audioBuf = await decodeSingleVoiceSample(ctx, VOICE_MALE_SAMPLE_URIS[i]);
        voiceMaleAudioBuffers[i] = audioBuf;
      } catch (err) {
        console.warn("Could not decode male voice sample", i, err);
      }
    }
  }

  isVoicePreloading = false;
}

// Queue of notes scheduled for visual sync
const notesInQueue = [];

// Beat callback for visual UI updates
let onBeatCallback = null;

function setOnBeatCallback(callback) {
  onBeatCallback = callback;
}

// Initialize audio context on first user interaction
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  preloadVoiceBuffers(audioCtx);
  return audioCtx;
}

// Generate 1 second of white noise for realistic percussive synthesis
function getNoiseBuffer(ctx) {
  if (!noiseBuffer) {
    const bufferSize = Math.floor(ctx.sampleRate * 1.0);
    noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

// Sound 1: Drum Kit - Damped Kick Drum on Beat 1 (Grosse caisse mate)
function scheduleDampedKick(ctx, time) {
  // Low-frequency sine pitch drop (punchy attack sliding to sub fundamental)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(145, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.075);

  // Mate acoustic decay (tight envelope without lingering bass boom)
  gain.gain.setValueAtTime(1.0, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + 0.12);

  // Beater attack transient: short filtered click for realistic skin impact
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, time);
  filter.Q.setValueAtTime(2.0, time);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.4, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

  noiseSource.connect(filter);
  filter.connect(clickGain);
  clickGain.connect(ctx.destination);

  noiseSource.start(time);
  noiseSource.stop(time + 0.025);
}

// Sound 1: Drum Kit - Closed Hi-Hat on other beats (Charley fermee)
function scheduleClosedHiHat(ctx, time) {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(ctx);

  // High-pass + bandpass filtering for crisp metallic sizzle
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(7500, time);

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(9500, time);
  bandpass.Q.setValueAtTime(3.0, time);

  // Very snappy, tight exponential decay
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.85, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

  noiseSource.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);

  noiseSource.start(time);
  noiseSource.stop(time + 0.05);
}

// Sound 2: Classic Woodblock Click
function scheduleWoodblock(ctx, time, isFirstBeat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (isFirstBeat) {
    osc.frequency.setValueAtTime(1400, time);
    osc.frequency.exponentialRampToValueAtTime(350, time + 0.04);
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
  } else {
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.03);
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
  }

  osc.start(time);
  osc.stop(time + 0.05);
}

// Sound 3: Electronic Metronome Beep
function scheduleElectronicBeep(ctx, time, isFirstBeat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (isFirstBeat) {
    osc.frequency.setValueAtTime(1760, time); // A6
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  } else {
    osc.frequency.setValueAtTime(880, time); // A5
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
  }

  osc.start(time);
  osc.stop(time + 0.045);
}

// Sound 4: Real Human Voice Counting ("One, Two, Three, Four, Five, Six...")
function scheduleVoiceCount(ctx, time, beatNumber, gender = "female") {
  const buffers = (gender === "male") ? voiceMaleAudioBuffers : voiceFemaleAudioBuffers;
  const totalBuffers = (buffers && buffers.length > 0) ? buffers.length : 8;
  const wordIndex = ((beatNumber || 0) % totalBuffers);
  const buffer = (buffers && buffers.length > wordIndex) ? buffers[wordIndex] : null;

  if (buffer) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    // Subtle volume accent on beat 1
    gain.gain.setValueAtTime(beatNumber === 0 ? 1.0 : 0.88, time);

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start(time);
  } else {
    // If buffers not ready yet, trigger preload and play fallback
    preloadVoiceBuffers(ctx);
    scheduleSynthesizedVoiceCount(ctx, time, beatNumber);
  }
}

function scheduleSynthesizedVoiceCount(ctx, time, beatNumber) {
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = "triangle";
  clickOsc.frequency.setValueAtTime(1400, time);
  clickGain.gain.setValueAtTime(0.25, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.008);
  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);
  clickOsc.start(time);
  clickOsc.stop(time + 0.01);

  // Synthesize spoken count based on beat index (0 to 5)
  const wordIndex = ((beatNumber || 0) % 6);

  if (wordIndex === 0) {
    // "ONE" (w - uh - n)
    scheduleVoicedFormants(ctx, time, 160, 110, 0.16, 460, 960, 2400, 0.85);
  } else if (wordIndex === 1) {
    // "TWO" (t - oo)
    scheduleConsonantNoise(ctx, time, 0.02, 4000, 2.0, 0.45);
    scheduleVoicedFormants(ctx, time + 0.012, 145, 115, 0.14, 340, 850, 2200, 0.75);
  } else if (wordIndex === 2) {
    // "THREE" (th - r - ee)
    scheduleConsonantNoise(ctx, time, 0.025, 2800, 1.5, 0.35);
    scheduleVoicedFormants(ctx, time + 0.015, 150, 120, 0.16, 300, 2300, 2800, 0.75);
  } else if (wordIndex === 3) {
    // "FOUR" (f - or)
    scheduleConsonantNoise(ctx, time, 0.03, 3000, 1.2, 0.35);
    scheduleVoicedFormants(ctx, time + 0.018, 145, 105, 0.17, 560, 920, 2450, 0.8);
  } else if (wordIndex === 4) {
    // "FIVE" (f - eye - v)
    scheduleConsonantNoise(ctx, time, 0.025, 3200, 1.2, 0.35);
    scheduleVoicedFormants(ctx, time + 0.015, 150, 112, 0.17, 650, 1500, 2600, 0.8);
  } else {
    // "SIX" (s - ih - ks)
    scheduleConsonantNoise(ctx, time, 0.03, 6500, 2.0, 0.5);
    scheduleVoicedFormants(ctx, time + 0.015, 145, 125, 0.08, 420, 1950, 2600, 0.7);
    scheduleConsonantNoise(ctx, time + 0.09, 0.035, 6500, 2.0, 0.4);
  }
}

function scheduleVoicedFormants(ctx, time, startPitch, endPitch, duration, f1, f2, f3, gainLevel) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(startPitch, time);
  osc.frequency.exponentialRampToValueAtTime(endPitch, time + duration);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(gainLevel, time);
  masterGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  // Formant F1 (Throat/Mouth openness)
  const bp1 = ctx.createBiquadFilter();
  bp1.type = "bandpass";
  bp1.frequency.setValueAtTime(f1, time);
  bp1.Q.setValueAtTime(4.0, time);

  // Formant F2 (Tongue placement)
  const bp2 = ctx.createBiquadFilter();
  bp2.type = "bandpass";
  bp2.frequency.setValueAtTime(f2, time);
  bp2.Q.setValueAtTime(5.0, time);

  // Formant F3 (Brightness)
  const bp3 = ctx.createBiquadFilter();
  bp3.type = "bandpass";
  bp3.frequency.setValueAtTime(f3, time);
  bp3.Q.setValueAtTime(5.0, time);

  const g1 = ctx.createGain();
  g1.gain.value = 1.0;
  const g2 = ctx.createGain();
  g2.gain.value = 0.7;
  const g3 = ctx.createGain();
  g3.gain.value = 0.4;

  osc.connect(bp1);
  bp1.connect(g1);
  g1.connect(masterGain);

  osc.connect(bp2);
  bp2.connect(g2);
  g2.connect(masterGain);

  osc.connect(bp3);
  bp3.connect(g3);
  g3.connect(masterGain);

  masterGain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + duration + 0.01);
}

function scheduleConsonantNoise(ctx, time, duration, filterFreq, filterQ, gainLevel) {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, time);
  filter.Q.setValueAtTime(filterQ, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainLevel, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noiseSource.start(time);
  noiseSource.stop(time + duration + 0.01);
}

// Sound 5: Cowbell (Roland TR-808 style dual resonant bell)
function scheduleCowbell(ctx, time, isFirstBeat) {
  const freq1 = isFirstBeat ? 587 : 540;
  const freq2 = isFirstBeat ? 845 : 790;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "square";
  osc2.type = "square";
  osc1.frequency.setValueAtTime(freq1, time);
  osc2.frequency.setValueAtTime(freq2, time);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(isFirstBeat ? 820 : 760, time);
  filter.Q.setValueAtTime(2.5, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(isFirstBeat ? 0.9 : 0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (isFirstBeat ? 0.09 : 0.065));

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 0.1);
  osc2.stop(time + 0.1);
}

// Sound 6: Mechanical Clockwork Click (Traditional Maelzel / Wittner Pendulum Metronome)
function scheduleMechanicalClick(ctx, time, isFirstBeat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  const startF = isFirstBeat ? 420 : 290;
  osc.frequency.setValueAtTime(startF, time);
  osc.frequency.exponentialRampToValueAtTime(90, time + 0.025);

  gain.gain.setValueAtTime(isFirstBeat ? 0.85 : 0.6, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.035);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(isFirstBeat ? 2400 : 1900, time);
  filter.Q.setValueAtTime(3.5, time);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(isFirstBeat ? 0.5 : 0.35, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012);

  noiseSource.connect(filter);
  filter.connect(clickGain);
  clickGain.connect(ctx.destination);

  noiseSource.start(time);
  noiseSource.stop(time + 0.015);
}

// Sound 7: Acoustic Cross-Stick (Snare rim cross-stick)
function scheduleCrossStick(ctx, time, isFirstBeat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(isFirstBeat ? 1680 : 1520, time);
  osc.frequency.exponentialRampToValueAtTime(320, time + 0.035);

  gain.gain.setValueAtTime(isFirstBeat ? 0.9 : 0.65, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.045);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(3800, time);
  filter.Q.setValueAtTime(2.0, time);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(isFirstBeat ? 0.35 : 0.22, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

  noiseSource.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  noiseSource.start(time);
  noiseSource.stop(time + 0.025);
}

// Synthesize tick based on selected sound type
function scheduleTick(time, isFirstBeat, beatNumber) {
  if (isAudioMuted || currentSoundType === "silent") {
    return;
  }

  const ctx = getAudioContext();

  if (currentSoundType === "voice_female") {
    scheduleVoiceCount(ctx, time, beatNumber, "female");
  } else if (currentSoundType === "voice_male" || currentSoundType === "voice") {
    scheduleVoiceCount(ctx, time, beatNumber, "male");
  } else if (currentSoundType === "drumkit") {
    if (isFirstBeat) {
      scheduleDampedKick(ctx, time);
    } else {
      scheduleClosedHiHat(ctx, time);
    }
  } else if (currentSoundType === "cowbell") {
    scheduleCowbell(ctx, time, isFirstBeat);
  } else if (currentSoundType === "mechanical") {
    scheduleMechanicalClick(ctx, time, isFirstBeat);
  } else if (currentSoundType === "rimshot") {
    scheduleCrossStick(ctx, time, isFirstBeat);
  } else if (currentSoundType === "beep") {
    scheduleElectronicBeep(ctx, time, isFirstBeat);
  } else {
    // "woodblock"
    scheduleWoodblock(ctx, time, isFirstBeat);
  }
}

// Advances to the next beat
function advanceNextNote() {
  const secondsPerBeat = 60.0 / currentTempo;
  nextNoteTime += secondsPerBeat;
  currentBeatInMeasure = (currentBeatInMeasure + 1) % beatsPerMeasure;
}

// Schedules notes within the lookahead window
function scheduler() {
  const ctx = getAudioContext();

  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_TIME_SEC) {
    const isFirstBeat = (currentBeatInMeasure === 0);

    // Push note into queue for visual sync
    notesInQueue.push({
      noteNumber: currentBeatInMeasure,
      time: nextNoteTime,
      isFirstBeat: isFirstBeat
    });

    scheduleTick(nextNoteTime, isFirstBeat, currentBeatInMeasure);
    advanceNextNote();
  }

  timerId = window.setTimeout(scheduler, LOOKAHEAD_INTERVAL_MS);
}

// Visual drawing loop aligned with requestAnimationFrame
function visualSyncLoop() {
  if (!isPlaying) {
    return;
  }

  const ctx = getAudioContext();
  const currentTime = ctx.currentTime;

  while (notesInQueue.length > 0 && notesInQueue[0].time <= currentTime) {
    const currentNote = notesInQueue.shift();
    if (onBeatCallback) {
      onBeatCallback(currentNote.noteNumber, currentNote.isFirstBeat);
    }
  }

  requestAnimationFrame(visualSyncLoop);
}

// Public engine controls
function startMetronomeEngine() {
  if (isPlaying) {
    return;
  }

  const ctx = getAudioContext();
  isPlaying = true;
  currentBeatInMeasure = 0;
  nextNoteTime = ctx.currentTime + 0.05;
  notesInQueue.length = 0;

  scheduler();
  requestAnimationFrame(visualSyncLoop);
}

function stopMetronomeEngine() {
  isPlaying = false;
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  notesInQueue.length = 0;
}

// Resynchronize on-the-fly to Beat 1 (measure downbeat)
function resyncEngineToBeatOne() {
  if (!isPlaying) {
    return;
  }

  const ctx = getAudioContext();

  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  notesInQueue.length = 0;

  currentBeatInMeasure = 0;
  nextNoteTime = ctx.currentTime + 0.005;

  scheduleTick(nextNoteTime, true, 0);

  notesInQueue.push({
    noteNumber: 0,
    time: nextNoteTime,
    isFirstBeat: true
  });

  advanceNextNote();
  scheduler();

  if (onBeatCallback) {
    onBeatCallback(0, true);
  }
}

function setEngineTempo(bpm) {
  const clamped = Math.max(30, Math.min(300, Math.round(bpm)));
  currentTempo = clamped;
}

function setEngineBeatsPerMeasure(beats) {
  const parsed = parseInt(beats, 10);
  if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
    beatsPerMeasure = parsed;
    currentBeatInMeasure = 0;
  }
}

function setEngineMuted(muted) {
  isAudioMuted = Boolean(muted);
  if (isAudioMuted) {
    currentSoundType = "silent";
  }
}

function setEngineSoundType(type) {
  currentSoundType = type || "beep";
  isAudioMuted = (currentSoundType === "silent");
  if ((currentSoundType === "voice_female" || currentSoundType === "voice_male" || currentSoundType === "voice") && audioCtx) {
    preloadVoiceBuffers(audioCtx);
  }
}

function getEngineSoundType() {
  return currentSoundType;
}

function isEnginePlaying() {
  return isPlaying;
}

