// Instrument Tuner Engine & UI
// Pure procedural implementation using Web Audio API and Autocorrelation

let tunerAudioCtx = null;
let tunerAnalyser = null;
let tunerSource = null;
let tunerMediaStream = null;
let tunerRafId = null;
let isTunerActive = false;

// Buffer size for analysis (2048 or 4096 samples; 4096 is great for low bass notes ~40Hz)
const BUFFER_SIZE = 4096;
const buffer = new Float32Array(BUFFER_SIZE);

// Musical note definitions (A4 = 440 Hz standard)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// French Solfege note names without accents per project rules
const NOTE_NAMES_FRENCH = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

let tunerNotation = "both"; // "both", "french", "anglo"

function getFrenchNoteName(noteName) {
  if (!noteName || noteName === "-") return "-";
  const upper = noteName.toUpperCase();
  const idx = NOTE_NAMES.indexOf(upper);
  if (idx !== -1) {
    return NOTE_NAMES_FRENCH[idx];
  }
  return noteName;
}

// Instrument preset tunings
const INSTRUMENT_PRESETS = {
  chromatic: {
    name: "Chromatic",
    strings: [] // Free detection across all notes
  },
  guitar: {
    name: "Guitar (Standard)",
    strings: [
      { note: "E", octave: 2, freq: 82.41 },
      { note: "A", octave: 2, freq: 110.00 },
      { note: "D", octave: 3, freq: 146.83 },
      { note: "G", octave: 3, freq: 196.00 },
      { note: "B", octave: 3, freq: 246.94 },
      { note: "E", octave: 4, freq: 329.63 }
    ]
  },
  bass: {
    name: "Electric Bass (4-Str)",
    strings: [
      { note: "E", octave: 1, freq: 41.20 },
      { note: "A", octave: 1, freq: 55.00 },
      { note: "D", octave: 2, freq: 73.42 },
      { note: "G", octave: 2, freq: 98.00 }
    ]
  },
  ukulele: {
    name: "Ukulele (Standard)",
    strings: [
      { note: "G", octave: 4, freq: 392.00 },
      { note: "C", octave: 4, freq: 261.63 },
      { note: "E", octave: 4, freq: 329.63 },
      { note: "A", octave: 4, freq: 440.00 }
    ]
  },
  violin: {
    name: "Violin",
    strings: [
      { note: "G", octave: 3, freq: 196.00 },
      { note: "D", octave: 4, freq: 293.66 },
      { note: "A", octave: 4, freq: 440.00 },
      { note: "E", octave: 5, freq: 659.25 }
    ]
  },
  banjo: {
    name: "Banjo 5-Strings (Open G)",
    strings: [
      { note: "g", octave: 4, freq: 392.00 }, // short 5th drone string
      { note: "D", octave: 3, freq: 146.83 },
      { note: "G", octave: 3, freq: 196.00 },
      { note: "B", octave: 3, freq: 246.94 },
      { note: "D", octave: 4, freq: 293.66 }
    ]
  }
};

let currentInstrument = "guitar";
let lockedTargetStringIndex = -1; // -1 means auto-detect string

// Autocorrelation pitch detection algorithm
function autoCorrelate(buf, sampleRate) {
  // Check Root Mean Square (volume level) to discard background silence
  let sumSquares = 0;
  for (let i = 0; i < buf.length; i++) {
    sumSquares += buf[i] * buf[i];
  }
  const rms = Math.sqrt(sumSquares / buf.length);
  if (rms < 0.015) {
    // Too quiet / background noise
    return -1;
  }

  // Trim silence from start and end
  let r1 = 0;
  let r2 = buf.length - 1;
  const thres = 0.2;
  for (let i = 0; i < buf.length / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < buf.length / 2; i++) {
    if (Math.abs(buf[buf.length - i]) < thres) {
      r2 = buf.length - i;
      break;
    }
  }

  const trimmedBuf = buf.slice(r1, r2);
  const c = new Float32Array(trimmedBuf.length);

  // Compute autocorrelation
  for (let i = 0; i < trimmedBuf.length; i++) {
    for (let j = 0; j < trimmedBuf.length - i; j++) {
      c[i] = c[i] + trimmedBuf[j] * trimmedBuf[j + i];
    }
  }

  // Find first dip
  let d = 0;
  while (c[d] > c[d + 1]) {
    d++;
  }

  // Find peak after the dip
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < trimmedBuf.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;

  // Parabolic interpolation for sub-sample precision
  const x1 = c[T0 - 1];
  const x2 = c[T0];
  const x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) {
    T0 = T0 - b / (2 * a);
  }

  return sampleRate / T0;
}

// Convert frequency to nearest musical note, octave, and cent offset
function getNoteDetails(freq) {
  const noteNum = 12 * (Math.log2(freq / 440)) + 69;
  const roundedNoteNum = Math.round(noteNum);
  const noteIndex = (roundedNoteNum % 12 + 12) % 12;
  const octave = Math.floor(roundedNoteNum / 12) - 1;
  const standardFreq = 440 * Math.pow(2, (roundedNoteNum - 69) / 12);
  const cents = Math.round(1200 * Math.log2(freq / standardFreq));

  return {
    name: NOTE_NAMES[noteIndex],
    octave: octave,
    standardFreq: standardFreq,
    cents: cents
  };
}

// Start microphone capture and pitch loop
async function startTuner() {
  if (isTunerActive) return;

  const btn = document.getElementById("toggleTunerBtn");
  const errorAlert = document.getElementById("tunerErrorAlert");
  if (errorAlert) errorAlert.classList.add("d-none");

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone API not available in this context. Please ensure you are accessing via https:// or localhost.");
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    tunerAudioCtx = new AudioContextClass();
    if (tunerAudioCtx.state === "suspended") {
      await tunerAudioCtx.resume();
    }

    // Disable all audio processing filters to capture pure musical pitch
    tunerMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    tunerSource = tunerAudioCtx.createMediaStreamSource(tunerMediaStream);
    tunerAnalyser = tunerAudioCtx.createAnalyser();
    tunerAnalyser.fftSize = BUFFER_SIZE;
    tunerSource.connect(tunerAnalyser);

    isTunerActive = true;
    if (btn) {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-danger");
      btn.innerHTML = '<i class="bi bi-mic-mute-fill me-2"></i>Stop Tuner';
    }

    tunerProcessLoop();
  } catch (err) {
    console.error("Microphone access failed:", err);
    isTunerActive = false;
    if (btn) {
      btn.classList.remove("btn-danger");
      btn.classList.add("btn-primary");
      btn.innerHTML = '<i class="bi bi-mic-fill me-2"></i>Start Tuner';
    }
    if (errorAlert) {
      errorAlert.textContent = err.message || "Microphone access denied or unavailable. Please grant microphone permissions in your browser.";
      errorAlert.classList.remove("d-none");
    }
  }
}

// Stop microphone capture
function stopTuner() {
  if (!isTunerActive) return;

  isTunerActive = false;
  if (tunerRafId) {
    cancelAnimationFrame(tunerRafId);
    tunerRafId = null;
  }

  if (tunerMediaStream) {
    tunerMediaStream.getTracks().forEach(function (track) {
      track.stop();
    });
    tunerMediaStream = null;
  }

  if (tunerAudioCtx) {
    tunerAudioCtx.close();
    tunerAudioCtx = null;
  }

  const btn = document.getElementById("toggleTunerBtn");
  if (btn) {
    btn.classList.remove("btn-danger");
    btn.classList.add("btn-primary");
    btn.innerHTML = '<i class="bi bi-mic-fill me-2"></i>Start Tuner';
  }

  resetTunerView();
}

// Reset UI indicators
function resetTunerView() {
  const noteNameEl = document.getElementById("tunerNoteName");
  const noteOctaveEl = document.getElementById("tunerNoteOctave");
  const noteFrenchEl = document.getElementById("tunerNoteFrench");
  const freqEl = document.getElementById("tunerFrequency");
  const centsEl = document.getElementById("tunerCents");
  const needle = document.getElementById("tunerNeedle");

  if (noteNameEl) noteNameEl.textContent = "-";
  if (noteOctaveEl) noteOctaveEl.textContent = "";
  if (noteFrenchEl) noteFrenchEl.textContent = "-";
  if (freqEl) freqEl.textContent = "-- Hz";
  if (centsEl) centsEl.textContent = "0 cents";
  if (needle) {
    needle.style.left = "50%";
    needle.classList.remove("in-tune");
  }
}

// Continuous audio analysis loop
function tunerProcessLoop() {
  if (!isTunerActive || !tunerAnalyser) return;

  tunerAnalyser.getFloatTimeDomainData(buffer);
  const freq = autoCorrelate(buffer, tunerAudioCtx.sampleRate);

  const noteNameEl = document.getElementById("tunerNoteName");
  const noteOctaveEl = document.getElementById("tunerNoteOctave");
  const noteFrenchEl = document.getElementById("tunerNoteFrench");
  const freqEl = document.getElementById("tunerFrequency");
  const centsEl = document.getElementById("tunerCents");
  const needle = document.getElementById("tunerNeedle");
  const statusEl = document.getElementById("tunerStatusMessage");

  // Valid pitch detected (between 30 Hz and 2000 Hz)
  if (freq !== -1 && freq >= 30 && freq <= 2000) {
    const details = getNoteDetails(freq);
    let cents = details.cents;
    let targetNoteText = details.name;
    let targetOctave = details.octave;

    // Check against locked target string if selected
    const preset = INSTRUMENT_PRESETS[currentInstrument];
    if (preset && preset.strings.length > 0) {
      if (lockedTargetStringIndex >= 0 && lockedTargetStringIndex < preset.strings.length) {
        const targetStr = preset.strings[lockedTargetStringIndex];
        cents = Math.round(1200 * Math.log2(freq / targetStr.freq));
        targetNoteText = targetStr.note;
        targetOctave = targetStr.octave;
      } else {
        // Auto-match closest string in this instrument
        let closestStr = preset.strings[0];
        let minDiff = Math.abs(1200 * Math.log2(freq / closestStr.freq));
        for (let i = 1; i < preset.strings.length; i++) {
          const diff = Math.abs(1200 * Math.log2(freq / preset.strings[i].freq));
          if (diff < minDiff) {
            minDiff = diff;
            closestStr = preset.strings[i];
          }
        }
        highlightActiveStringButton(closestStr.note + closestStr.octave);
      }
    }

    // Clamp cents for display (-50 to +50)
    const clampedCents = Math.max(-50, Math.min(50, cents));
    // Percentage for needle (0% = -50 cents, 50% = 0 cents, 100% = +50 cents)
    const needlePercent = 50 + (clampedCents);

    const frenchName = getFrenchNoteName(targetNoteText);

    if (tunerNotation === "french") {
      if (noteNameEl) noteNameEl.textContent = frenchName;
      if (noteOctaveEl) noteOctaveEl.textContent = targetOctave;
      if (noteFrenchEl) noteFrenchEl.textContent = targetNoteText + (targetOctave !== "" ? " " + targetOctave : "");
    } else if (tunerNotation === "anglo") {
      if (noteNameEl) noteNameEl.textContent = targetNoteText;
      if (noteOctaveEl) noteOctaveEl.textContent = targetOctave;
      if (noteFrenchEl) noteFrenchEl.textContent = "";
    } else {
      // Both Anglo and French notation (default)
      if (noteNameEl) noteNameEl.textContent = targetNoteText;
      if (noteOctaveEl) noteOctaveEl.textContent = targetOctave;
      if (noteFrenchEl) noteFrenchEl.textContent = frenchName + (targetOctave !== "" ? " " + targetOctave : "");
    }

    if (freqEl) freqEl.textContent = freq.toFixed(1) + " Hz";

    const isTunelnTune = Math.abs(cents) <= 3;
    if (centsEl) {
      if (isTunelnTune) {
        centsEl.textContent = "IN TUNE (±" + cents + "¢)";
        centsEl.className = "fw-bold text-success";
      } else if (cents < 0) {
        centsEl.textContent = cents + "¢ (Too Low / Flat)";
        centsEl.className = "fw-bold text-info";
      } else {
        centsEl.textContent = "+" + cents + "¢ (Too High / Sharp)";
        centsEl.className = "fw-bold text-warning";
      }
    }

    if (needle) {
      needle.style.left = needlePercent + "%";
      if (isTunelnTune) {
        needle.classList.add("in-tune");
      } else {
        needle.classList.remove("in-tune");
      }
    }

    if (statusEl) statusEl.textContent = "Listening...";
  } else {
    if (statusEl) statusEl.textContent = "Play a string...";
  }

  tunerRafId = requestAnimationFrame(tunerProcessLoop);
}

function renderInstrumentStringsButtons() {
  const container = document.getElementById("instrumentStringsContainer");
  if (!container) return;

  container.innerHTML = "";
  const preset = INSTRUMENT_PRESETS[currentInstrument];

  if (!preset || preset.strings.length === 0) {
    container.innerHTML = '<span class="text-white small fw-semibold">Chromatic mode: listens to any note</span>';
    return;
  }

  preset.strings.forEach(function (s, idx) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-light string-target-btn me-2 mb-2 text-white fw-bold d-inline-flex align-items-center";
    btn.setAttribute("data-string-id", s.note + s.octave);

    const french = getFrenchNoteName(s.note);
    let label = s.note + s.octave;
    if (tunerNotation === "french") {
      label = french + '<span class="ms-1 fs-6 opacity-75">' + s.octave + '</span>';
    } else if (tunerNotation === "both") {
      label = s.note + s.octave + '<span class="badge bg-dark border border-secondary text-white ms-2 px-2 py-1 fs-6">' + french + '</span>';
    } else {
      label = s.note + '<span class="ms-1 fs-6 opacity-75">' + s.octave + '</span>';
    }
    btn.innerHTML = label;

    btn.addEventListener("click", function () {
      if (lockedTargetStringIndex === idx) {
        lockedTargetStringIndex = -1; // Deselect to auto-detect
        btn.classList.remove("active-target");
      } else {
        lockedTargetStringIndex = idx;
        document.querySelectorAll(".string-target-btn").forEach(function (b) {
          b.classList.remove("active-target");
        });
        btn.classList.add("active-target");
      }
    });

    container.appendChild(btn);
  });
}

function highlightActiveStringButton(stringId) {
  if (lockedTargetStringIndex !== -1) return; // Keep manual lock
  document.querySelectorAll(".string-target-btn").forEach(function (b) {
    if (b.getAttribute("data-string-id") === stringId) {
      b.classList.add("active-target");
    } else {
      b.classList.remove("active-target");
    }
  });
}

function initTuner() {
  const toggleBtn = document.getElementById("toggleTunerBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      if (isTunerActive) {
        stopTuner();
      } else {
        startTuner();
      }
    });
  }

  const instrumentSelect = document.getElementById("tunerInstrumentSelect");
  if (instrumentSelect) {
    instrumentSelect.addEventListener("change", function () {
      currentInstrument = this.value;
      lockedTargetStringIndex = -1;
      renderInstrumentStringsButtons();
      resetTunerView();
    });
  }

  const notationSelect = document.getElementById("tunerNotationSelect");
  if (notationSelect) {
    const savedNotation = localStorage.getItem("tuner_notation");
    if (savedNotation) {
      tunerNotation = savedNotation;
      notationSelect.value = savedNotation;
    }
    notationSelect.addEventListener("change", function () {
      tunerNotation = this.value;
      localStorage.setItem("tuner_notation", tunerNotation);
      renderInstrumentStringsButtons();
      resetTunerView();
    });
  }

  renderInstrumentStringsButtons();
}

