// Metronome UI & Tap Tempo Controller
// Procedural functional implementation

let bpm = 120;
let timeSignature = 4;
let isMuted = false;
let fullscreenFlashEnabled = false;

// Tap tempo state
const tapTimestamps = [];
const TAP_RESET_TIMEOUT_MS = 2500;
let lastTapTime = 0;

// Screen wake lock sentinel
let wakeLockSentinel = null;

// Request screen wake lock to prevent phone from sleeping during gig/rehearsal
async function requestScreenWakeLock() {
  if ("wakeLock" in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", function () {
        wakeLockSentinel = null;
      });
    } catch (err) {
      console.warn("Screen wake lock error:", err);
    }
  }
}

// Release screen wake lock when stopped
async function releaseScreenWakeLock() {
  if (wakeLockSentinel !== null) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    } catch (err) {
      console.warn("Error releasing wake lock:", err);
    }
  }
}

// Re-acquire wake lock if page visibility changes back to visible
document.addEventListener("visibilitychange", async function () {
  if (document.visibilityState === "visible" && isEnginePlaying()) {
    await requestScreenWakeLock();
  }
});

// Update BPM UI display and engine
function updateBpm(newBpm) {
  bpm = Math.max(30, Math.min(300, Math.round(newBpm)));
  setEngineTempo(bpm);

  const tempoDisplay = document.getElementById("tempoDisplay");
  const tempoSlider = document.getElementById("tempoSlider");
  if (tempoDisplay) {
    tempoDisplay.textContent = bpm;
  }
  if (tempoSlider && parseInt(tempoSlider.value, 10) !== bpm) {
    tempoSlider.value = bpm;
  }
}

// Update time signature dots
function renderBeatDots() {
  const container = document.getElementById("beatDotsContainer");
  if (!container) return;

  container.innerHTML = "";
  for (let i = 0; i < timeSignature; i++) {
    const dot = document.createElement("span");
    dot.className = "beat-dot";
    dot.id = "beatDot_" + i;
    container.appendChild(dot);
  }
}

// Visual trigger called on each beat from audio engine
function handleBeat(beatNumber, isFirstBeat) {
  const flasher = document.getElementById("beatFlasher");
  const flasherText = document.getElementById("beatFlasherNumber");
  const screenOverlay = document.getElementById("screenFlashOverlay");

  // Update beat count text
  if (flasherText) {
    flasherText.textContent = beatNumber + 1;
  }

  // Flash circle indicator
  if (flasher) {
    flasher.classList.remove("flash-accent", "flash-normal");
    // Force reflow for animation restart
    void flasher.offsetWidth;

    if (isFirstBeat) {
      flasher.classList.add("flash-accent");
    } else {
      flasher.classList.add("flash-normal");
    }

    setTimeout(function () {
      flasher.classList.remove("flash-accent", "flash-normal");
    }, 90);
  }

  // Fullscreen silent flash if enabled
  if (screenOverlay && fullscreenFlashEnabled) {
    screenOverlay.classList.add("flash-active");
    setTimeout(function () {
      screenOverlay.classList.remove("flash-active");
    }, 60);
  }

  // Highlight active dot
  for (let i = 0; i < timeSignature; i++) {
    const dot = document.getElementById("beatDot_" + i);
    if (dot) {
      if (i === beatNumber) {
        dot.classList.add("active-beat");
      } else {
        dot.classList.remove("active-beat");
      }
    }
  }
}

// Tap Tempo logic
function handleTapTempo() {
  const now = performance.now();
  const timeSinceLastTap = now - lastTapTime;

  if (timeSinceLastTap > TAP_RESET_TIMEOUT_MS) {
    tapTimestamps.length = 0;
  }

  tapTimestamps.push(now);
  lastTapTime = now;

  // Need at least 2 taps to calculate intervals
  if (tapTimestamps.length >= 2) {
    // Keep max 5 recent taps
    if (tapTimestamps.length > 5) {
      tapTimestamps.shift();
    }

    const intervals = [];
    for (let i = 1; i < tapTimestamps.length; i++) {
      intervals.push(tapTimestamps[i] - tapTimestamps[i - 1]);
    }

    // Calculate median interval to resist outlier tap jitters
    intervals.sort(function (a, b) {
      return a - b;
    });
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    if (medianInterval > 0) {
      const calculatedBpm = Math.round(60000 / medianInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        updateBpm(calculatedBpm);
      }
    }
  }

  // Tap button visual feedback
  const tapBtn = document.getElementById("tapButton");
  const tapLabel = document.getElementById("tapSubtext");
  if (tapLabel) {
    tapLabel.textContent = "Tap " + tapTimestamps.length + " (BPM " + bpm + ")";
    clearTimeout(tapBtn._timeoutId);
    tapBtn._timeoutId = setTimeout(function () {
      tapLabel.textContent = "Tap to detect tempo";
    }, 2000);
  }
}

// Toggle Play/Stop
async function togglePlayMetronome() {
  const playBtn = document.getElementById("playButton");
  const playIcon = document.getElementById("playButtonIcon");
  const playText = document.getElementById("playButtonText");

  if (isEnginePlaying()) {
    stopMetronomeEngine();
    await releaseScreenWakeLock();

    if (playBtn) {
      playBtn.classList.remove("btn-danger");
      playBtn.classList.add("btn-success");
    }
    if (playIcon) {
      playIcon.className = "bi bi-play-fill me-2";
    }
    if (playText) {
      playText.textContent = "Start";
    }

    // Reset dots and flasher
    const flasherText = document.getElementById("beatFlasherNumber");
    if (flasherText) flasherText.textContent = "-";
    for (let i = 0; i < timeSignature; i++) {
      const dot = document.getElementById("beatDot_" + i);
      if (dot) dot.classList.remove("active-beat");
    }
  } else {
    startMetronomeEngine();
    await requestScreenWakeLock();

    if (playBtn) {
      playBtn.classList.remove("btn-success");
      playBtn.classList.add("btn-danger");
    }
    if (playIcon) {
      playIcon.className = "bi bi-stop-fill me-2";
    }
    if (playText) {
      playText.textContent = "Stop";
    }
  }
}

// Initialize metronome controls and listeners
function initMetronome() {
  setOnBeatCallback(handleBeat);
  setEngineTempo(bpm);
  setEngineBeatsPerMeasure(timeSignature);
  renderBeatDots();

  // Play button
  const playBtn = document.getElementById("playButton");
  if (playBtn) {
    playBtn.addEventListener("click", togglePlayMetronome);
  }

  // Tap button
  const tapBtn = document.getElementById("tapButton");
  if (tapBtn) {
    tapBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      handleTapTempo();
    });
  }

  // Tempo slider
  const slider = document.getElementById("tempoSlider");
  if (slider) {
    slider.addEventListener("input", function () {
      updateBpm(this.value);
    });
  }

  // Increment / Decrement buttons
  document.querySelectorAll("[data-bpm-delta]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const delta = parseInt(this.getAttribute("data-bpm-delta"), 10);
      updateBpm(bpm + delta);
    });
  });

  // Time signature select
  const sigSelect = document.getElementById("timeSignatureSelect");
  if (sigSelect) {
    sigSelect.addEventListener("change", function () {
      timeSignature = parseInt(this.value, 10);
      setEngineBeatsPerMeasure(timeSignature);
      renderBeatDots();
    });
  }

  // Audio Mute toggle (Silent mode)
  const muteCheck = document.getElementById("muteAudioCheck");
  if (muteCheck) {
    muteCheck.addEventListener("change", function () {
      isMuted = this.checked;
      setEngineMuted(isMuted);
    });
  }

  // Fullscreen flash toggle
  const flashCheck = document.getElementById("fullscreenFlashCheck");
  if (flashCheck) {
    flashCheck.addEventListener("change", function () {
      fullscreenFlashEnabled = this.checked;
    });
  }
}
