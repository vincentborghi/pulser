// Ambient Auto-BPM Detector using Web Audio API
// High-precision Multi-Band Spectral Flux (Novelty Curve) + Autocorrelation Beat Tracking

let autoBpmAudioCtx = null;
let autoBpmStream = null;
let autoBpmSourceNode = null;
let autoBpmAnalyser = null;
let autoBpmTimerId = null;

let isAutoBpmListening = false;
let autoBpmDetectedValue = null;
let autoBpmLastBeatTime = 0;
let autoBpmBeatCounter = 0;

// Algorithm parameters
const AUTO_BPM_SAMPLE_RATE_HZ = 50; // 50 Hz frame rate (20ms)
const AUTO_BPM_BUFFER_FRAMES = 250;  // 5 seconds circular history
const autoBpmFluxHistory = [];
const autoBpmRecentEstimates = [];
let autoBpmPrevFreqData = null;
let autoBpmAnalysisTick = 0;

function renderAutoBpmBeatDots() {
  const container = document.getElementById("autoBpmBeatDots");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement("span");
    dot.className = "beat-dot" + (i === 0 ? " first-beat" : "");
    dot.id = "autoBpmDot_" + i;
    container.appendChild(dot);
  }
}

function advanceAutoBpmBeatDot() {
  const currentBeat = autoBpmBeatCounter % 4;
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById("autoBpmDot_" + i);
    if (!dot) continue;
    if (i === currentBeat) {
      if (i === 0) {
        dot.classList.add("active-beat-accent");
        dot.classList.remove("active-beat-normal");
      } else {
        dot.classList.add("active-beat-normal");
        dot.classList.remove("active-beat-accent");
      }
    } else {
      dot.classList.remove("active-beat-accent", "active-beat-normal");
    }
  }
  autoBpmBeatCounter++;
}

function resetAutoBpmBeatDots() {
  autoBpmBeatCounter = 0;
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById("autoBpmDot_" + i);
    if (dot) {
      dot.classList.remove("active-beat-accent", "active-beat-normal");
    }
  }
}

function initAutoBpm() {
  renderAutoBpmBeatDots();
  const modalEl = document.getElementById("autoBpmModal");
  const listenBtn = document.getElementById("autoBpmListenToggleBtn");
  const applyBtn = document.getElementById("autoBpmApplyBtn");
  const halveBtn = document.getElementById("autoBpmHalveBtn");
  const doubleBtn = document.getElementById("autoBpmDoubleBtn");

  if (listenBtn) {
    listenBtn.addEventListener("click", function () {
      if (isAutoBpmListening) {
        stopAutoBpmListening();
      } else {
        startAutoBpmListening();
      }
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener("click", function () {
      if (autoBpmDetectedValue) {
        if (typeof updateBpm === "function") {
          updateBpm(autoBpmDetectedValue);
        } else if (typeof setBpm === "function") {
          setBpm(autoBpmDetectedValue);
        }
        stopAutoBpmListening();
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
          const modalInstance = bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) {
            modalInstance.hide();
          }
        }
      }
    });
  }

  if (halveBtn) {
    halveBtn.addEventListener("click", function () {
      if (autoBpmDetectedValue) {
        const halved = Math.round(autoBpmDetectedValue / 2);
        if (halved >= 30) {
          updateDetectedBpm(halved);
        }
      }
    });
  }

  if (doubleBtn) {
    doubleBtn.addEventListener("click", function () {
      if (autoBpmDetectedValue) {
        const doubled = Math.round(autoBpmDetectedValue * 2);
        if (doubled <= 300) {
          updateDetectedBpm(doubled);
        }
      }
    });
  }

  if (modalEl) {
    modalEl.addEventListener("hidden.bs.modal", function () {
      stopAutoBpmListening();
      resetAutoBpmUI();
    });
  }
}

async function startAutoBpmListening() {
  const statusText = document.getElementById("autoBpmStatusText");
  const listenBtn = document.getElementById("autoBpmListenToggleBtn");
  const listenText = document.getElementById("autoBpmListenBtnText");

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (statusText) statusText.textContent = "Microphone access is not supported by your browser.";
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    autoBpmStream = stream;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    autoBpmAudioCtx = new AudioContextClass();
    if (autoBpmAudioCtx.state === "suspended") {
      await autoBpmAudioCtx.resume();
    }

    autoBpmSourceNode = autoBpmAudioCtx.createMediaStreamSource(stream);

    // Multi-band frequency analyser (256 frequency bins from 0Hz to ~22kHz)
    autoBpmAnalyser = autoBpmAudioCtx.createAnalyser();
    autoBpmAnalyser.fftSize = 512;
    autoBpmAnalyser.smoothingTimeConstant = 0.25;

    autoBpmSourceNode.connect(autoBpmAnalyser);

    isAutoBpmListening = true;
    autoBpmLastBeatTime = 0;
    autoBpmFluxHistory.length = 0;
    autoBpmRecentEstimates.length = 0;
    autoBpmPrevFreqData = new Uint8Array(autoBpmAnalyser.frequencyBinCount);
    autoBpmAnalysisTick = 0;

    if (listenBtn) {
      listenBtn.classList.remove("btn-primary");
      listenBtn.classList.add("btn-danger");
    }
    if (listenText) {
      listenText.textContent = "Stop Listening";
    }
    if (statusText) {
      statusText.textContent = "Listening to ambient music... Hold device near sound source";
      statusText.className = "text-white-50 fw-semibold mt-1";
    }

    // 50Hz accurate audio sampling timer (20ms interval)
    autoBpmTimerId = setInterval(processAutoBpmFrame, 20);
  } catch (err) {
    console.error("Auto-BPM mic access error:", err);
    if (statusText) {
      statusText.textContent = "Microphone access was denied or unavailable.";
    }
    stopAutoBpmListening();
  }
}

function stopAutoBpmListening() {
  isAutoBpmListening = false;

  if (autoBpmTimerId !== null) {
    clearInterval(autoBpmTimerId);
    autoBpmTimerId = null;
  }

  if (autoBpmStream) {
    autoBpmStream.getTracks().forEach(function (track) {
      track.stop();
    });
    autoBpmStream = null;
  }

  if (autoBpmAudioCtx) {
    if (autoBpmAudioCtx.state !== "closed") {
      autoBpmAudioCtx.close();
    }
    autoBpmAudioCtx = null;
  }

  const listenBtn = document.getElementById("autoBpmListenToggleBtn");
  const listenText = document.getElementById("autoBpmListenBtnText");
  const levelBar = document.getElementById("autoBpmLevelBar");
  const beatIndicator = document.getElementById("autoBpmBeatIndicator");

  if (listenBtn) {
    listenBtn.classList.remove("btn-danger");
    listenBtn.classList.add("btn-primary");
  }
  if (listenText) {
    listenText.textContent = "Start Listening";
  }
  if (levelBar) {
    levelBar.style.width = "0%";
  }
  if (beatIndicator) {
    beatIndicator.className = "badge bg-secondary text-white px-2 py-1 fw-bold";
    beatIndicator.textContent = "Inactive";
  }
  resetAutoBpmBeatDots();
}

function resetAutoBpmUI() {
  autoBpmDetectedValue = null;
  resetAutoBpmBeatDots();
  const valDisplay = document.getElementById("autoBpmValueDisplay");
  const statusText = document.getElementById("autoBpmStatusText");
  const applyBtn = document.getElementById("autoBpmApplyBtn");
  const halveBtn = document.getElementById("autoBpmHalveBtn");
  const doubleBtn = document.getElementById("autoBpmDoubleBtn");
  const halfVal = document.getElementById("autoBpmHalfVal");
  const doubleVal = document.getElementById("autoBpmDoubleVal");

  if (valDisplay) valDisplay.textContent = "---";
  if (statusText) {
    statusText.textContent = 'Click "Start Listening" near speakers or playing instruments';
    statusText.className = "text-white-50 fw-semibold mt-1";
  }
  if (applyBtn) applyBtn.disabled = true;
  if (halveBtn) halveBtn.disabled = true;
  if (doubleBtn) doubleBtn.disabled = true;
  if (halfVal) halfVal.textContent = "--";
  if (doubleVal) doubleVal.textContent = "--";
}

function processAutoBpmFrame() {
  if (!isAutoBpmListening || !autoBpmAnalyser) return;

  const binCount = autoBpmAnalyser.frequencyBinCount;
  const freqData = new Uint8Array(binCount);
  autoBpmAnalyser.getByteFrequencyData(freqData);

  // 1. Calculate Multi-Band Spectral Flux (Novelty)
  // Evaluates sudden positive bursts of energy across bass, snare, and percussion bands
  let flux = 0;
  let totalEnergy = 0;
  const maxAnalyzedBin = Math.min(75, binCount);

  for (let k = 1; k < maxAnalyzedBin; k++) {
    let weight = 1.0;
    if (k <= 4) {
      weight = 2.6; // Bass drum / sub transients (~50 - 350 Hz)
    } else if (k <= 20) {
      weight = 1.8; // Snare, guitar, vocals, keys (~350 - 1700 Hz)
    } else {
      weight = 1.2; // Hi-hats, tambourines, cymbal transients (~1700 - 6500 Hz)
    }

    const diff = freqData[k] - (autoBpmPrevFreqData ? autoBpmPrevFreqData[k] : 0);
    if (diff > 0) {
      flux += diff * weight;
    }
    totalEnergy += freqData[k];
    if (autoBpmPrevFreqData) {
      autoBpmPrevFreqData[k] = freqData[k];
    }
  }

  // Update visual mic level meter
  const levelPercent = Math.min(100, Math.round((totalEnergy / (maxAnalyzedBin * 128)) * 100 * 2.5));
  const levelBar = document.getElementById("autoBpmLevelBar");
  if (levelBar) {
    levelBar.style.width = levelPercent + "%";
  }

  // Push flux to history buffer (up to 5 seconds of continuous frames)
  autoBpmFluxHistory.push(flux);
  if (autoBpmFluxHistory.length > AUTO_BPM_BUFFER_FRAMES) {
    autoBpmFluxHistory.shift();
  }

  // 2. Onset & Beat Dots Trigger
  // Adaptive local moving average over past 35 frames (~0.7s)
  const windowSize = Math.min(35, autoBpmFluxHistory.length);
  let localSum = 0;
  for (let i = autoBpmFluxHistory.length - windowSize; i < autoBpmFluxHistory.length; i++) {
    localSum += autoBpmFluxHistory[i];
  }
  const localMean = localSum / windowSize;
  const onsetThreshold = localMean * 1.55 + 18.0;

  const now = performance.now();
  // Refractory lockout of 220ms prevents double-triggering on the same drum hit
  if (flux > onsetThreshold && (now - autoBpmLastBeatTime) > 220) {
    handleDetectedBeatOnset(now);
  }

  // 3. Periodic Autocorrelation Tempo Estimation (runs every 20 frames = ~400ms)
  autoBpmAnalysisTick++;
  if (autoBpmAnalysisTick % 20 === 0 && autoBpmFluxHistory.length >= 75) {
    computeAutocorrelationTempo();
  }
}

function handleDetectedBeatOnset(timestamp) {
  advanceAutoBpmBeatDot();

  const beatIndicator = document.getElementById("autoBpmBeatIndicator");
  if (beatIndicator) {
    beatIndicator.className = "badge bg-info text-dark px-2 py-1 fw-bold";
    beatIndicator.textContent = "Beat! 🥁";
    clearTimeout(beatIndicator._timeout);
    beatIndicator._timeout = setTimeout(function () {
      if (beatIndicator) {
        beatIndicator.className = "badge bg-secondary text-white px-2 py-1 fw-bold";
        beatIndicator.textContent = "Listening...";
      }
    }, 110);
  }

  autoBpmLastBeatTime = timestamp;
}

function computeAutocorrelationTempo() {
  const numFrames = autoBpmFluxHistory.length;
  if (numFrames < 75) return;

  // Zero-mean highpass novelty curve
  let sumFlux = 0;
  for (let i = 0; i < numFrames; i++) sumFlux += autoBpmFluxHistory[i];
  const meanFlux = sumFlux / numFrames;

  const cleanFlux = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    cleanFlux[i] = Math.max(0, autoBpmFluxHistory[i] - meanFlux);
  }

  // Lags corresponding to 45 BPM to 220 BPM at 50Hz
  const minLag = Math.round(AUTO_BPM_SAMPLE_RATE_HZ * (60.0 / 220.0)); // ~14 frames
  const maxLag = Math.round(AUTO_BPM_SAMPLE_RATE_HZ * (60.0 / 45.0));  // ~67 frames
  const priorLag = AUTO_BPM_SAMPLE_RATE_HZ * (60.0 / 115.0);          // 25 frames (~115 BPM)

  let bestLag = minLag;
  let maxCorr = -1;
  const corrValues = new Float32Array(maxLag + 2);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < numFrames - lag; i++) {
      sum += cleanFlux[i] * cleanFlux[i + lag];
      count++;
    }
    const rawCorr = count > 0 ? (sum / count) : 0;
    corrValues[lag] = rawCorr;

    // Log-normal perceptual tempo prior (favors natural musical tempo 80-150 BPM)
    const logRatio = Math.log2(lag / priorLag);
    const priorWeight = Math.exp(-0.5 * logRatio * logRatio * 1.5);
    const weightedCorr = rawCorr * priorWeight;

    if (weightedCorr > maxCorr) {
      maxCorr = weightedCorr;
      bestLag = lag;
    }
  }

  // Parabolic interpolation for sub-sample accuracy
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = corrValues[bestLag - 1];
    const y1 = corrValues[bestLag];
    const y2 = corrValues[bestLag + 1];
    const denom = (y0 - 2 * y1 + y2);
    if (Math.abs(denom) > 1e-6) {
      const delta = (0.5 * (y0 - y2)) / denom;
      if (Math.abs(delta) < 1.0) {
        refinedLag = bestLag + delta;
      }
    }
  }

  const rawBpm = Math.round((AUTO_BPM_SAMPLE_RATE_HZ * 60.0) / refinedLag);
  if (rawBpm >= 40 && rawBpm <= 240) {
    evaluateTempoStability(rawBpm);
  }
}

function evaluateTempoStability(candidateBpm) {
  autoBpmRecentEstimates.push(candidateBpm);
  if (autoBpmRecentEstimates.length > 6) {
    autoBpmRecentEstimates.shift();
  }

  // Find median of recent estimates
  const sorted = autoBpmRecentEstimates.slice().sort(function (a, b) { return a - b; });
  const median = sorted[Math.floor(sorted.length / 2)];

  // Count how many recent estimates are within +/- 2 BPM of the median
  let closeCount = 0;
  for (let i = 0; i < autoBpmRecentEstimates.length; i++) {
    if (Math.abs(autoBpmRecentEstimates[i] - median) <= 2) {
      closeCount++;
    }
  }

  // When at least 3 estimates agree closely, we have a reliable stable BPM
  if (closeCount >= 3) {
    updateDetectedBpm(median);
  }
}

function updateDetectedBpm(bpm) {
  autoBpmDetectedValue = bpm;

  const valDisplay = document.getElementById("autoBpmValueDisplay");
  const statusText = document.getElementById("autoBpmStatusText");
  const applyBtn = document.getElementById("autoBpmApplyBtn");
  const halveBtn = document.getElementById("autoBpmHalveBtn");
  const doubleBtn = document.getElementById("autoBpmDoubleBtn");
  const halfVal = document.getElementById("autoBpmHalfVal");
  const doubleVal = document.getElementById("autoBpmDoubleVal");

  if (valDisplay) {
    valDisplay.textContent = bpm;
  }
  if (statusText) {
    statusText.textContent = "Stable BPM detected!";
    statusText.className = "text-success fw-bold mt-1";
  }

  if (applyBtn) {
    applyBtn.disabled = false;
    const applyVal = document.getElementById("autoBpmApplyValue");
    if (applyVal) applyVal.textContent = bpm;
  }

  const half = Math.round(bpm / 2);
  const double = Math.round(bpm * 2);

  if (halveBtn) {
    halveBtn.disabled = (half < 30);
  }
  if (halfVal) {
    halfVal.textContent = half;
  }

  if (doubleBtn) {
    doubleBtn.disabled = (double > 300);
  }
  if (doubleVal) {
    doubleVal.textContent = double;
  }
}

function isAutoBpmActive() {
  return isAutoBpmListening;
}

function getAutoBpmDetectedValue() {
  return autoBpmDetectedValue;
}
