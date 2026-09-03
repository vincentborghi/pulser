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
let currentSoundType = "drumkit"; // "drumkit", "woodblock", "beep", "silent"
let noiseBuffer = null;

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

// Synthesize tick based on selected sound type
function scheduleTick(time, isFirstBeat) {
  if (isAudioMuted || currentSoundType === "silent") {
    return;
  }

  const ctx = getAudioContext();

  if (currentSoundType === "drumkit") {
    if (isFirstBeat) {
      scheduleDampedKick(ctx, time);
    } else {
      scheduleClosedHiHat(ctx, time);
    }
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

    scheduleTick(nextNoteTime, isFirstBeat);
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
  currentSoundType = type || "drumkit";
  isAudioMuted = (currentSoundType === "silent");
}

function getEngineSoundType() {
  return currentSoundType;
}

function isEnginePlaying() {
  return isPlaying;
}

