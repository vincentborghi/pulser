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
const AUTO_BPM_BUFFER_FRAMES = 300;  // 6 seconds circular history
const autoBpmFluxHistory = [];
const autoBpmHistogram = new Float32Array(241); // Bins from 0 to 240 BPM
let autoBpmStableStreak = 0;
let autoBpmLastCandidateBpm = 0;
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
    modalEl.addEventListener("show.bs.modal", function () {
      const alertBox = document.getElementById("autoBpmMetroRunningAlert");
      const isMetroRunning = (typeof isEnginePlaying === "function") && isEnginePlaying();
      if (alertBox) {
        if (isMetroRunning) {
          alertBox.classList.remove("d-none");
          alertBox.className = "alert alert-warning py-2 px-3 mb-3 text-start d-flex align-items-center justify-content-between";
          alertBox.innerHTML = `
            <div>
              <div class="fw-bold text-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i>Metronome is running</div>
              <div class="small text-white-50">Stop it so the microphone only hears ambient music?</div>
            </div>
            <button type="button" id="autoBpmStopMetroBtn" class="btn btn-sm btn-danger fw-bold text-nowrap ms-2">
              <i class="bi bi-stop-fill me-1"></i>Stop Now
            </button>
          `;
          const stopBtn = document.getElementById("autoBpmStopMetroBtn");
          if (stopBtn) {
            stopBtn.addEventListener("click", function () {
              if (typeof isEnginePlaying === "function" && isEnginePlaying()) {
                const playBtn = document.getElementById("playButton");
                if (playBtn) playBtn.click();
              }
              alertBox.className = "alert alert-success py-2 px-3 mb-3 text-start";
              alertBox.innerHTML = '<i class="bi bi-check-circle-fill me-2 text-success"></i><strong>Metronome stopped.</strong> Ready to listen.';
              setTimeout(function () {
                alertBox.classList.add("d-none");
              }, 2000);
            });
          }
        } else {
          alertBox.classList.add("d-none");
        }
      }
    });

    modalEl.addEventListener("hidden.bs.modal", function () {
      stopAutoBpmListening();
      resetAutoBpmUI();
    });
  }
}

async function startAutoBpmListening() {
  // Proactively stop metronome if still running so mic does not capture clicks
  if (typeof isEnginePlaying === "function" && isEnginePlaying()) {
    const playBtn = document.getElementById("playButton");
    if (playBtn) playBtn.click();
    const alertBox = document.getElementById("autoBpmMetroRunningAlert");
    if (alertBox) {
      alertBox.className = "alert alert-success py-2 px-3 mb-3 text-start";
      alertBox.innerHTML = '<i class="bi bi-check-circle-fill me-2 text-success"></i><strong>Metronome stopped.</strong> Listening...';
      alertBox.classList.remove("d-none");
      setTimeout(function () {
        alertBox.classList.add("d-none");
      }, 2000);
    }
  }

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
    autoBpmHistogram.fill(0);
    autoBpmStableStreak = 0;
    autoBpmLastCandidateBpm = 0;
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
  autoBpmHistogram.fill(0);
  autoBpmStableStreak = 0;
  autoBpmLastCandidateBpm = 0;
}

function resetAutoBpmUI() {
  autoBpmDetectedValue = null;
  autoBpmHistogram.fill(0);
  autoBpmStableStreak = 0;
  autoBpmLastCandidateBpm = 0;
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

  // 1. Calculate Multi-Band Spectral Flux with transient weighting
  // Strong emphasis on kick/bass (bins 1-5) and snare/strum (bins 6-22)
  // High frequencies are attenuated to avoid subdivision / double-speed bias
  let flux = 0;
  let totalEnergy = 0;
  const maxAnalyzedBin = Math.min(65, binCount);

  for (let k = 1; k < maxAnalyzedBin; k++) {
    let weight = 1.0;
    if (k <= 5) {
      weight = 3.2; // Sub and Bass drum (~40 - 450 Hz)
    } else if (k <= 22) {
      weight = 1.6; // Snare, guitar, vocals, keys (~450 - 2000 Hz)
    } else {
      weight = 0.6; // Cymbals, hi-hats (attenuated to prevent subdivision bias)
    }

    const prev = autoBpmPrevFreqData ? autoBpmPrevFreqData[k] : 0;
    const diff = freqData[k] - prev;
    if (diff > 0) {
      // Logarithmic compression for transient novelty
      flux += Math.log1p(diff * 0.15) * weight * 10;
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

  // Push flux to circular history buffer
  autoBpmFluxHistory.push(flux);
  if (autoBpmFluxHistory.length > AUTO_BPM_BUFFER_FRAMES) {
    autoBpmFluxHistory.shift();
  }

  // 2. Onset & Beat Dots Trigger
  const windowSize = Math.min(35, autoBpmFluxHistory.length);
  let localSum = 0;
  for (let i = autoBpmFluxHistory.length - windowSize; i < autoBpmFluxHistory.length; i++) {
    localSum += autoBpmFluxHistory[i];
  }
  const localMean = localSum / windowSize;
  const onsetThreshold = localMean * 1.5 + 15.0;

  const now = performance.now();
  if (flux > onsetThreshold && (now - autoBpmLastBeatTime) > 220) {
    handleDetectedBeatOnset(now);
  }

  // 3. Periodic Autocorrelation Tempo Estimation (runs every 15 frames = ~300ms)
  // Requires at least 100 frames (~2.0s of music) to have adequate rhythmic context
  autoBpmAnalysisTick++;
  if (autoBpmAnalysisTick % 15 === 0 && autoBpmFluxHistory.length >= 100) {
    computeAutocorrelationTempo();
  }
}

function handleDetectedBeatOnset(timestamp) {
  advanceAutoBpmBeatDot();

  const beatIndicator = document.getElementById("autoBpmBeatIndicator");
  if (beatIndicator) {
    beatIndicator.className = "badge bg-info text-dark px-2 py-1 fw-bold";
    beatIndicator.textContent = "Beat!";
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
  if (numFrames < 100) return;

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
  const maxLagToCompute = Math.min(maxLag * 2 + 2, numFrames - 2);

  // 1. Calculate raw autocorrelation for lags up to 2*maxLag to allow harmonic comb calculations
  const rawCorr = new Float32Array(maxLagToCompute + 2);
  for (let lag = Math.floor(minLag / 2); lag <= maxLagToCompute; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < numFrames - lag; i++) {
      sum += cleanFlux[i] * cleanFlux[i + lag];
      count++;
    }
    rawCorr[lag] = count > 0 ? (sum / count) : 0;
  }

  // 2. Harmonic Comb Filter Summation
  // A true musical beat at lag tau also produces autocorrelation energy at 2*tau (every 2 beats)
  // and has subdivisions at tau/2 (sub-beats/eighth notes).
  // Combining these harmonics reinforces the true fundamental beat and strongly suppresses
  // jumping between single and double speed (octave confusion).
  const combScores = new Float32Array(maxLag + 1);
  const priorCenterBpm = 112.0;

  let bestLag = minLag;
  let maxCombScore = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const r1 = rawCorr[lag];
    const r2 = (lag * 2 <= maxLagToCompute) ? rawCorr[lag * 2] : 0;
    const r3 = (lag * 3 <= maxLagToCompute) ? rawCorr[lag * 3] : 0;
    const halfLag = Math.round(lag / 2);
    const rHalf = (halfLag < rawCorr.length) ? rawCorr[halfLag] : 0;

    // Comb combination: fundamental + 0.65*second_harmonic + 0.25*third_harmonic + 0.35*sub_harmonic
    const comb = r1 + 0.65 * r2 + 0.25 * r3 + 0.35 * rHalf;

    // Smooth log-normal perceptual tempo prior (favors natural musical tempo 80-150 BPM)
    const candidateBpm = (AUTO_BPM_SAMPLE_RATE_HZ * 60.0) / lag;
    const logRatio = Math.log2(candidateBpm / priorCenterBpm);
    const priorWeight = Math.exp(-0.5 * logRatio * logRatio * 1.8);

    const weightedScore = comb * priorWeight;
    combScores[lag] = weightedScore;

    if (weightedScore > maxCombScore) {
      maxCombScore = weightedScore;
      bestLag = lag;
    }
  }

  // Parabolic interpolation for sub-sample accuracy
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = combScores[bestLag - 1];
    const y1 = combScores[bestLag];
    const y2 = combScores[bestLag + 1];
    const denom = (y0 - 2 * y1 + y2);
    if (Math.abs(denom) > 1e-6) {
      const delta = (0.5 * (y0 - y2)) / denom;
      if (Math.abs(delta) < 1.0) {
        refinedLag = bestLag + delta;
      }
    }
  }

  let candidateBpm = Math.round((AUTO_BPM_SAMPLE_RATE_HZ * 60.0) / refinedLag);

  // Octave folding / disambiguation
  if (candidateBpm > 160) {
    const doubleLag = Math.round(refinedLag * 2);
    if (doubleLag <= maxLag && combScores[doubleLag] >= maxCombScore * 0.60) {
      candidateBpm = Math.round(candidateBpm / 2);
    }
  } else if (candidateBpm < 75) {
    const halfLag = Math.round(refinedLag / 2);
    if (halfLag >= minLag && combScores[halfLag] >= maxCombScore * 0.60) {
      candidateBpm = candidateBpm * 2;
    }
  }

  if (candidateBpm >= 45 && candidateBpm <= 220) {
    evaluateTempoStability(candidateBpm);
  }
}

function evaluateTempoStability(candidateBpm) {
  // 1. Decay the tempo evidence histogram (exponential moving memory over ~3 seconds)
  const decay = 0.85;
  for (let b = 40; b <= 230; b++) {
    autoBpmHistogram[b] *= decay;
  }

  // 2. Add Gaussian-smoothed weight around the candidate BPM
  const spread = 2;
  for (let delta = -spread; delta <= spread; delta++) {
    const b = candidateBpm + delta;
    if (b >= 40 && b <= 230) {
      const w = Math.exp(-0.5 * (delta * delta) / 1.5);
      autoBpmHistogram[b] += w * 1.5;
    }
  }

  // 3. Find dominant peak in the histogram
  let peakBpm = 0;
  let peakEnergy = 0;
  for (let b = 45; b <= 220; b++) {
    if (autoBpmHistogram[b] > peakEnergy) {
      peakEnergy = autoBpmHistogram[b];
      peakBpm = b;
    }
  }

  // 4. Require strong accumulated evidence and consistency
  if (peakEnergy >= 2.8) {
    if (Math.abs(peakBpm - autoBpmLastCandidateBpm) <= 2) {
      autoBpmStableStreak++;
    } else {
      // Octave jump protection: if the candidate is close to 2x or 0.5x of the currently
      // detected BPM, reject immediate jump unless evidence has dominated for a long period
      if (autoBpmDetectedValue) {
        const ratio = peakBpm / autoBpmDetectedValue;
        if ((ratio >= 1.85 && ratio <= 2.15) || (ratio >= 0.45 && ratio <= 0.55)) {
          // Suppress single-to-double fluctuation
          return;
        }
      }
      autoBpmStableStreak = 1;
      autoBpmLastCandidateBpm = peakBpm;
    }

    // Require 3 consistent updates (~900ms) before confirming the tempo
    if (autoBpmStableStreak >= 3) {
      updateDetectedBpm(peakBpm);
    }
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
