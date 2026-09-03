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

// Synthesize a sharp, clean percussive click (no audio files needed)
function scheduleTick(time, isFirstBeat) {
  if (isAudioMuted) {
    return;
  }

  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (isFirstBeat) {
    // High-pitched woodblock click for measure accent
    osc.frequency.setValueAtTime(1400, time);
    osc.frequency.exponentialRampToValueAtTime(350, time + 0.04);
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
  } else {
    // Normal beat click
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.03);
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
  }

  osc.start(time);
  osc.stop(time + 0.05);
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
}

function isEnginePlaying() {
  return isPlaying;
}
