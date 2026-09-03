// Ambient Auto-BPM Detector using Web Audio API
// Captures microphone input, applies low-pass beat filtering, computes onsets, and estimates BPM

let autoBpmAudioCtx = null;
let autoBpmStream = null;
let autoBpmSourceNode = null;
let autoBpmFilterNode = null;
let autoBpmAnalyser = null;
let autoBpmAnimFrameId = null;

let isAutoBpmListening = false;
let autoBpmDetectedValue = null;
let autoBpmLastBeatTime = 0;
let autoBpmIntervalHistory = [];
let autoBpmEnergyHistory = [];
let autoBpmBeatCounter = 0;

const AUTO_BPM_MIN_TEMPO = 40;
const AUTO_BPM_MAX_TEMPO = 240;
const AUTO_BPM_MIN_INTERVAL = 60.0 / AUTO_BPM_MAX_TEMPO; // ~0.25s
const AUTO_BPM_MAX_INTERVAL = 60.0 / AUTO_BPM_MIN_TEMPO; // ~1.5s

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

    // Low-pass filter to isolate rhythmic bass drums / percussion transients (60Hz to 160Hz)
    autoBpmFilterNode = autoBpmAudioCtx.createBiquadFilter();
    autoBpmFilterNode.type = "lowpass";
    autoBpmFilterNode.frequency.setValueAtTime(160, autoBpmAudioCtx.currentTime);
    autoBpmFilterNode.Q.setValueAtTime(1.5, autoBpmAudioCtx.currentTime);

    // Highpass to eliminate mic handling rumble below 40Hz
    const highpass = autoBpmAudioCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(40, autoBpmAudioCtx.currentTime);

    autoBpmAnalyser = autoBpmAudioCtx.createAnalyser();
    autoBpmAnalyser.fftSize = 1024;
    autoBpmAnalyser.smoothingTimeConstant = 0.2;

    autoBpmSourceNode.connect(highpass);
    highpass.connect(autoBpmFilterNode);
    autoBpmFilterNode.connect(autoBpmAnalyser);

    isAutoBpmListening = true;
    autoBpmLastBeatTime = 0;
    autoBpmIntervalHistory = [];
    autoBpmEnergyHistory = [];

    if (listenBtn) {
      listenBtn.classList.remove("btn-primary");
      listenBtn.classList.add("btn-danger");
    }
    if (listenText) {
      listenText.textContent = "Stop Listening";
    }
    if (statusText) {
      statusText.textContent = "Listening to ambient music... Hold device near sound source";
    }

    processAutoBpmAudio();
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

  if (autoBpmAnimFrameId !== null) {
    cancelAnimationFrame(autoBpmAnimFrameId);
    autoBpmAnimFrameId = null;
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
    statusText.className = "text-white-50 fw-semibold mt-2";
  }
  if (applyBtn) applyBtn.disabled = true;
  if (halveBtn) halveBtn.disabled = true;
  if (doubleBtn) doubleBtn.disabled = true;
  if (halfVal) halfVal.textContent = "--";
  if (doubleVal) doubleVal.textContent = "--";
}

function processAutoBpmAudio() {
  if (!isAutoBpmListening || !autoBpmAnalyser) return;

  const bufferLength = autoBpmAnalyser.fftSize;
  const timeData = new Float32Array(bufferLength);
  autoBpmAnalyser.getFloatTimeDomainData(timeData);

  // Compute root-mean-square (RMS) energy
  let sumSquares = 0;
  for (let i = 0; i < bufferLength; i++) {
    sumSquares += timeData[i] * timeData[i];
  }
  const rms = Math.sqrt(sumSquares / bufferLength);

  // Update visual audio level bar
  const levelPercent = Math.min(100, Math.round(rms * 450));
  const levelBar = document.getElementById("autoBpmLevelBar");
  if (levelBar) {
    levelBar.style.width = levelPercent + "%";
  }

  // Sliding energy history to compute dynamic threshold
  autoBpmEnergyHistory.push(rms);
  if (autoBpmEnergyHistory.length > 35) {
    autoBpmEnergyHistory.shift();
  }

  let avgEnergy = 0;
  for (let i = 0; i < autoBpmEnergyHistory.length; i++) {
    avgEnergy += autoBpmEnergyHistory[i];
  }
  avgEnergy /= autoBpmEnergyHistory.length;

  const dynamicThreshold = avgEnergy * 1.5 + 0.006;
  const now = performance.now();

  // Peak detection with refractory lockout (min interval between beats = 220ms -> ~270 BPM)
  if (rms > dynamicThreshold && (now - autoBpmLastBeatTime) > 220) {
    handleDetectedBeatOnset(now);
  }

  autoBpmAnimFrameId = requestAnimationFrame(processAutoBpmAudio);
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

  if (autoBpmLastBeatTime > 0) {
    const intervalSec = (timestamp - autoBpmLastBeatTime) / 1000.0;

    if (intervalSec >= AUTO_BPM_MIN_INTERVAL && intervalSec <= AUTO_BPM_MAX_INTERVAL) {
      autoBpmIntervalHistory.push(intervalSec);
      if (autoBpmIntervalHistory.length > 16) {
        autoBpmIntervalHistory.shift();
      }

      if (autoBpmIntervalHistory.length >= 4) {
        estimateBpmFromIntervals(autoBpmIntervalHistory);
      }
    }
  }

  autoBpmLastBeatTime = timestamp;
}

function estimateBpmFromIntervals(intervals) {
  // Convert intervals to BPM candidates
  const bpmCandidates = [];

  for (let i = 0; i < intervals.length; i++) {
    const rawBpm = 60.0 / intervals[i];
    bpmCandidates.push(rawBpm);

    // Also consider half and double times
    if (rawBpm * 2 <= AUTO_BPM_MAX_TEMPO) {
      bpmCandidates.push(rawBpm * 2);
    }
    if (rawBpm / 2 >= AUTO_BPM_MIN_TEMPO) {
      bpmCandidates.push(rawBpm / 2);
    }
  }

  // Normalize candidates into primary musical listening window (70 - 165 BPM)
  const normalized = bpmCandidates.map(function (bpm) {
    let b = bpm;
    while (b < 70) b *= 2;
    while (b > 165) b /= 2;
    return b;
  });

  // Cluster candidates using bin tolerance (within +/- 3.5 BPM)
  const clusters = [];

  normalized.forEach(function (val) {
    let foundCluster = false;
    for (let c = 0; c < clusters.length; c++) {
      if (Math.abs(clusters[c].center - val) <= 3.5) {
        clusters[c].items.push(val);
        // Recalculate cluster center
        let sum = 0;
        for (let k = 0; k < clusters[c].items.length; k++) sum += clusters[c].items[k];
        clusters[c].center = sum / clusters[c].items.length;
        foundCluster = true;
        break;
      }
    }
    if (!foundCluster) {
      clusters.push({ center: val, items: [val] });
    }
  });

  // Find cluster with the highest density
  let bestCluster = null;
  for (let c = 0; c < clusters.length; c++) {
    if (!bestCluster || clusters[c].items.length > bestCluster.items.length) {
      bestCluster = clusters[c];
    }
  }

  if (bestCluster && bestCluster.items.length >= 4) {
    const estimatedBpm = Math.round(bestCluster.center);
    updateDetectedBpm(estimatedBpm);
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
