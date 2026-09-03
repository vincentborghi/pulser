// Metronome UI & Tap Tempo Controller
// Procedural functional implementation

let bpm = 120;
let timeSignature = 4;
let isMuted = false;
let flashMode = "vivid"; // "off", "subtle", "vivid", "strobe"
let lastActiveSoundType = "drumkit";
let lastActiveFlashMode = "vivid";

// Tap tempo state & multi-level undo stack
const tapTimestamps = [];
const TAP_RESET_TIMEOUT_MS = 2500;
let lastTapTime = 0;
const tapUndoHistory = []; // Stack of previous tempos e.g. [120, 135]
let currentTapSequenceBaseBpm = null;
let hasPushedSequenceToHistory = false;

function updateUndoTapButton() {
  const undoBtn = document.getElementById("undoTapBtn");
  const undoBpmEl = document.getElementById("undoTapBpm");

  if (!undoBtn) return;

  if (tapUndoHistory.length > 0) {
    const targetBpm = tapUndoHistory[tapUndoHistory.length - 1];
    if (undoBpmEl) {
      undoBpmEl.textContent = targetBpm;
    }
    undoBtn.classList.remove("invisible");
    undoBtn.disabled = false;
  } else {
    undoBtn.classList.add("invisible");
    undoBtn.disabled = true;
  }
}

function clearTapUndoHistory() {
  tapUndoHistory.length = 0;
  currentTapSequenceBaseBpm = null;
  hasPushedSequenceToHistory = false;
  updateUndoTapButton();
}

function undoTappedBpm() {
  if (tapUndoHistory.length > 0) {
    const previousBpm = tapUndoHistory.pop();
    tapTimestamps.length = 0;
    currentTapSequenceBaseBpm = null;
    hasPushedSequenceToHistory = false;
    updateBpm(previousBpm, true); // Preserve remaining history stack
    updateUndoTapButton();
  }
}

// Tempo History qualification state (qualifies after running for at least 3 measures)
let beatsAtCurrentTempo = 0;
let hasAddedCurrentTempoToHistory = false;
const MAX_TEMPO_HISTORY_ITEMS = 20;

function getTempoHistory() {
  try {
    const data = localStorage.getItem("metronome_tempo_history");
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveTempoHistory(history) {
  try {
    localStorage.setItem("metronome_tempo_history", JSON.stringify(history));
  } catch (e) {}
}

function addTempoToHistory(tempoBpm, sig) {
  let history = getTempoHistory();
  // Filter out any previous entry for this exact BPM so it bubbles to the top
  history = history.filter(function (item) {
    return item.bpm !== tempoBpm;
  });
  history.unshift({
    bpm: tempoBpm,
    timeSignature: sig || timeSignature,
    timestamp: Date.now()
  });
  if (history.length > MAX_TEMPO_HISTORY_ITEMS) {
    history = history.slice(0, MAX_TEMPO_HISTORY_ITEMS);
  }
  saveTempoHistory(history);
  renderTempoHistory();
}

function clearAllTempoHistory() {
  saveTempoHistory([]);
  renderTempoHistory();
}

function recallHistoryTempo(targetBpm, targetSig) {
  updateBpm(targetBpm, false);
  if (targetSig) {
    timeSignature = targetSig;
    setEngineBeatsPerMeasure(timeSignature);
    renderBeatDots();
    const sigSelect = document.getElementById("timeSignatureSelect");
    if (sigSelect) {
      sigSelect.value = targetSig;
    }
  }
  // Close modal if open
  const modalEl = document.getElementById("tempoHistoryModal");
  if (modalEl && typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
  }
}

function formatTimeAgo(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin + "m ago";
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return diffHours + "h ago";
  return Math.floor(diffHours / 24) + "d ago";
}

function renderTempoHistory() {
  const history = getTempoHistory();
  const badge = document.getElementById("tempoHistoryBadge");
  const listContainer = document.getElementById("tempoHistoryList");
  const emptyState = document.getElementById("tempoHistoryEmpty");

  if (badge) {
    badge.textContent = history.length;
    if (history.length > 0) {
      badge.classList.remove("d-none");
    } else {
      badge.classList.add("d-none");
    }
  }

  if (!listContainer) return;

  if (history.length === 0) {
    listContainer.innerHTML = "";
    if (emptyState) emptyState.classList.remove("d-none");
    return;
  }

  if (emptyState) emptyState.classList.add("d-none");
  listContainer.innerHTML = "";

  history.forEach(function (item) {
    const row = document.createElement("div");
    row.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center bg-dark text-white border-secondary p-2 mb-2 rounded shadow-sm";
    row.style.cursor = "pointer";

    const leftDiv = document.createElement("div");
    leftDiv.className = "d-flex align-items-center";

    const bpmSpan = document.createElement("span");
    bpmSpan.className = "fs-2 fw-bolder text-white me-2";
    bpmSpan.textContent = item.bpm;

    const bpmUnit = document.createElement("span");
    bpmUnit.className = "text-info fw-bold me-3";
    bpmUnit.textContent = "BPM";

    const sigBadge = document.createElement("span");
    sigBadge.className = "badge bg-secondary me-2 fs-6";
    sigBadge.textContent = (item.timeSignature || 4) + "/4";

    const timeSpan = document.createElement("small");
    timeSpan.className = "text-muted";
    timeSpan.textContent = formatTimeAgo(item.timestamp);

    leftDiv.appendChild(bpmSpan);
    leftDiv.appendChild(bpmUnit);
    leftDiv.appendChild(sigBadge);
    leftDiv.appendChild(timeSpan);

    const recallBtn = document.createElement("button");
    recallBtn.type = "button";
    recallBtn.className = "btn btn-outline-success fw-bold px-3 py-1 fs-6";
    recallBtn.innerHTML = '<i class="bi bi-play-circle me-1"></i>Load';

    row.appendChild(leftDiv);
    row.appendChild(recallBtn);

    row.addEventListener("click", function () {
      recallHistoryTempo(item.bpm, item.timeSignature);
    });

    listContainer.appendChild(row);
  });
}

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

// Quick BPM presets with 6 distinct colors and drag-and-drop reordering
const PRESETS_STORAGE_KEY = "metronome_quick_bpm_presets_v1";
const DEFAULT_PRESETS = [
  { id: "p1", bpm: 140, colorClass: "preset-color-1", name: "P1" },
  { id: "p2", bpm: 120, colorClass: "preset-color-2", name: "P2" },
  { id: "p3", bpm: 110, colorClass: "preset-color-3", name: "P3" },
  { id: "p4", bpm: 100, colorClass: "preset-color-4", name: "P4" },
  { id: "p5", bpm: 90,  colorClass: "preset-color-5", name: "P5" },
  { id: "p6", bpm: 80,  colorClass: "preset-color-6", name: "P6" }
];
let quickPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
let isSavingPresetMode = false;

// Drag and drop state
let draggedPresetIndex = null;
let touchDragStartIndex = null;
let touchMoved = false;
let touchStartPos = { x: 0, y: 0 };

// Load quick presets from storage (with migration for legacy format)
function loadQuickPresets() {
  try {
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 6) {
        quickPresets = parsed.map(function (item, idx) {
          if (typeof item === "number") {
            // Migrate legacy number format to colored preset objects
            return {
              id: "p" + (idx + 1),
              bpm: parseInt(item, 10) || 120,
              colorClass: "preset-color-" + (idx + 1),
              name: "P" + (idx + 1)
            };
          }
          return {
            id: item.id || ("p" + (idx + 1)),
            bpm: parseInt(item.bpm, 10) || 120,
            colorClass: item.colorClass || ("preset-color-" + (idx + 1)),
            name: item.name || ("P" + (idx + 1))
          };
        });
        return;
      }
    }
  } catch (err) {
    console.error("Failed to load quick presets:", err);
  }
  quickPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
}

// Save quick presets to storage
function saveQuickPresets() {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(quickPresets));
  } catch (err) {
    console.error("Failed to save quick presets:", err);
  }
}

// Reset quick presets to defaults
function resetQuickPresets() {
  quickPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
  saveQuickPresets();
  if (isSavingPresetMode) {
    toggleSavePresetMode(false);
  }
  renderQuickPresets();
}

// Reorder preset from one slot to another
function reorderPresets(fromIndex, toIndex) {
  if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= quickPresets.length || toIndex < 0 || toIndex >= quickPresets.length) return;

  const movedItem = quickPresets.splice(fromIndex, 1)[0];
  quickPresets.splice(toIndex, 0, movedItem);
  saveQuickPresets();
  renderQuickPresets();
}

// Render the 6 quick preset slots with distinct colors and drag-and-drop
function renderQuickPresets() {
  const container = document.getElementById("quickPresetsContainer");
  if (!container) return;

  container.innerHTML = "";

  quickPresets.forEach(function (presetItem, idx) {
    const col = document.createElement("div");
    col.className = "preset-col";
    col.dataset.index = idx;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn preset-btn " + presetItem.colorClass + (presetItem.bpm === bpm ? " active-preset" : "") + (isSavingPresetMode ? " saving-mode" : "");
    btn.id = "presetBtn_" + idx;
    btn.dataset.index = idx;
    btn.setAttribute("draggable", isSavingPresetMode ? "false" : "true");
    btn.innerHTML = `
      <div class="preset-name">${presetItem.name || ('P' + (idx + 1))}</div>
      <div class="preset-bpm">${presetItem.bpm}</div>
    `;

    // Click handler (Desktop and standard taps)
    btn.addEventListener("click", function (e) {
      if (touchMoved) return; // Ignore click triggered after touch drag

      if (isSavingPresetMode) {
        presetItem.bpm = bpm;
        saveQuickPresets();
        toggleSavePresetMode(false);
        renderQuickPresets();
      } else {
        updateBpm(presetItem.bpm);
      }
    });

    // Desktop HTML5 Drag and Drop events
    btn.addEventListener("dragstart", function (e) {
      if (isSavingPresetMode) {
        e.preventDefault();
        return;
      }
      draggedPresetIndex = idx;
      btn.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", idx);
    });

    btn.addEventListener("dragend", function () {
      btn.classList.remove("dragging");
      document.querySelectorAll(".preset-col").forEach(function (c) {
        c.classList.remove("drag-over");
      });
      draggedPresetIndex = null;
    });

    col.addEventListener("dragover", function (e) {
      if (draggedPresetIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      col.classList.add("drag-over");
    });

    col.addEventListener("dragleave", function () {
      col.classList.remove("drag-over");
    });

    col.addEventListener("drop", function (e) {
      e.preventDefault();
      col.classList.remove("drag-over");
      const toIndex = parseInt(col.dataset.index, 10);
      reorderPresets(draggedPresetIndex, toIndex);
      draggedPresetIndex = null;
    });

    // Touch Screen Drag and Drop events (for Android mobile touch)
    btn.addEventListener("touchstart", function (e) {
      if (isSavingPresetMode) return;
      touchMoved = false;
      touchDragStartIndex = idx;
      touchStartPos = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }, { passive: true });

    btn.addEventListener("touchmove", function (e) {
      if (isSavingPresetMode || touchDragStartIndex === null) return;

      const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.y);

      if (deltaX > 10 || deltaY > 10) {
        touchMoved = true;
        btn.classList.add("dragging");

        // Find element under touch point
        const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        const targetCol = el ? el.closest(".preset-col") : null;

        document.querySelectorAll(".preset-col").forEach(function (c) {
          c.classList.remove("drag-over");
        });

        if (targetCol) {
          targetCol.classList.add("drag-over");
        }
      }
    }, { passive: false });

    btn.addEventListener("touchend", function (e) {
      btn.classList.remove("dragging");

      if (touchMoved && touchDragStartIndex !== null) {
        const activeOver = document.querySelector(".preset-col.drag-over");
        if (activeOver) {
          const toIndex = parseInt(activeOver.dataset.index, 10);
          activeOver.classList.remove("drag-over");
          reorderPresets(touchDragStartIndex, toIndex);
        }
        document.querySelectorAll(".preset-col").forEach(function (c) {
          c.classList.remove("drag-over");
        });
      }

      touchDragStartIndex = null;
      setTimeout(function () {
        touchMoved = false;
      }, 50);
    });

    col.appendChild(btn);
    container.appendChild(col);
  });
}

// Toggle edit / save preset mode
function toggleSavePresetMode(forceState) {
  if (typeof forceState === "boolean") {
    isSavingPresetMode = forceState;
  } else {
    isSavingPresetMode = !isSavingPresetMode;
  }

  const hint = document.getElementById("savePresetHint");
  const toggleBtnText = document.getElementById("toggleSavePresetText");
  const currentBpmEl = document.getElementById("saveCurrentBpmValue");

  if (currentBpmEl) {
    currentBpmEl.textContent = bpm;
  }

  if (isSavingPresetMode) {
    if (hint) hint.classList.remove("d-none");
    if (toggleBtnText) toggleBtnText.textContent = "Cancel Save";
  } else {
    if (hint) hint.classList.add("d-none");
    if (toggleBtnText) toggleBtnText.textContent = "Save to Preset";
  }

  renderQuickPresets();
}

// Update BPM UI display and engine
function updateBpm(newBpm, preserveHistory) {
  const roundedBpm = Math.max(30, Math.min(300, Math.round(newBpm)));
  if (bpm !== roundedBpm) {
    beatsAtCurrentTempo = 0;
    hasAddedCurrentTempoToHistory = false;
  }
  bpm = roundedBpm;
  setEngineTempo(bpm);

  if (!preserveHistory) {
    clearTapUndoHistory();
  }

  const tempoDisplay = document.getElementById("tempoDisplay");
  const tempoSlider = document.getElementById("tempoSlider");
  const currentBpmEl = document.getElementById("saveCurrentBpmValue");

  if (tempoDisplay) {
    tempoDisplay.textContent = bpm;
  }
  if (tempoSlider && parseInt(tempoSlider.value, 10) !== bpm) {
    tempoSlider.value = bpm;
  }
  if (currentBpmEl) {
    currentBpmEl.textContent = bpm;
  }

  // Update active preset highlighting
  quickPresets.forEach(function (presetItem, idx) {
    const btn = document.getElementById("presetBtn_" + idx);
    if (btn) {
      if (presetItem.bpm === bpm) {
        btn.classList.add("active-preset");
      } else {
        btn.classList.remove("active-preset");
      }
    }
  });

  updateGlobalMetronomeBar();
}

// Resynchronize metronome on-the-fly to Beat 1
function resyncMetronomeToBeatOne() {
  if (typeof isEnginePlaying === "function" && isEnginePlaying()) {
    if (typeof resyncEngineToBeatOne === "function") {
      resyncEngineToBeatOne();
    }
  } else {
    // If not playing, start metronome directly on beat 1
    togglePlayMetronome();
  }
}

// Update time signature dots
function renderBeatDots() {
  const container = document.getElementById("beatDotsContainer");
  if (!container) return;

  container.innerHTML = "";
  for (let i = 0; i < timeSignature; i++) {
    const dot = document.createElement("span");
    dot.className = "beat-dot" + (i === 0 ? " first-beat" : "");
    dot.id = "beatDot_" + i;

    if (i === 0) {
      dot.style.cursor = "pointer";
      dot.title = "Click to resynchronize Beat 1";
      dot.setAttribute("role", "button");
      dot.setAttribute("aria-label", "Resynchronize Beat 1");
      dot.addEventListener("click", function (e) {
        e.stopPropagation();
        resyncMetronomeToBeatOne();
      });
    }

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

  // Configurable screen flash mode
  if (screenOverlay && flashMode !== "off") {
    screenOverlay.className = ""; // Reset previous classes

    let flashClass = "flash-vivid";
    let duration = 65;

    if (flashMode === "subtle") {
      flashClass = isFirstBeat ? "flash-subtle-accent" : "flash-subtle";
      duration = isFirstBeat ? 80 : 50;
    } else if (flashMode === "vivid") {
      flashClass = isFirstBeat ? "flash-vivid-accent" : "flash-vivid";
      duration = isFirstBeat ? 95 : 60;
    } else if (flashMode === "strobe") {
      // Strobe mode: pure high-contrast white on normal beats, intense neon green on beat 1
      flashClass = isFirstBeat ? "flash-strobe-accent" : "flash-strobe";
      duration = isFirstBeat ? 100 : 60;
    }

    screenOverlay.classList.add(flashClass, "flash-active");
    setTimeout(function () {
      screenOverlay.classList.remove("flash-active");
    }, duration);
  }

  // Update signature dots
  for (let i = 0; i < timeSignature; i++) {
    const dot = document.getElementById("beatDot_" + i);
    if (dot) {
      if (i === beatNumber) {
        dot.classList.add("active-beat");
        if (i === 0) {
          dot.classList.add("active-beat-accent");
          dot.classList.remove("active-beat-normal");
        } else {
          dot.classList.add("active-beat-normal");
          dot.classList.remove("active-beat-accent");
        }
      } else {
        dot.classList.remove("active-beat", "active-beat-accent", "active-beat-normal");
      }
    }
  }

  // Qualify tempo for history: must run for at least 3 full measures (3 * timeSignature beats)
  beatsAtCurrentTempo++;
  if (!hasAddedCurrentTempoToHistory && beatsAtCurrentTempo >= 3 * timeSignature) {
    addTempoToHistory(bpm, timeSignature);
    hasAddedCurrentTempoToHistory = true;
  }
}

// Tap Tempo logic
function handleTapTempo() {
  // Drumpad tactile strike visual feedback
  const tapBtn = document.getElementById("tapButton");
  if (tapBtn) {
    tapBtn.classList.add("pad-hit");
    clearTimeout(tapBtn._hitTimeout);
    tapBtn._hitTimeout = setTimeout(function () {
      tapBtn.classList.remove("pad-hit");
    }, 90);
  }

  const now = performance.now();
  const timeSinceLastTap = now - lastTapTime;

  // New tap sequence detected
  if (timeSinceLastTap > TAP_RESET_TIMEOUT_MS || tapTimestamps.length === 0) {
    tapTimestamps.length = 0;
    currentTapSequenceBaseBpm = bpm;
    hasPushedSequenceToHistory = false;
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
        // Push the sequence baseline tempo to the undo history stack once per sequence
        if (!hasPushedSequenceToHistory && currentTapSequenceBaseBpm !== null && currentTapSequenceBaseBpm !== calculatedBpm) {
          if (tapUndoHistory.length === 0 || tapUndoHistory[tapUndoHistory.length - 1] !== currentTapSequenceBaseBpm) {
            tapUndoHistory.push(currentTapSequenceBaseBpm);
            if (tapUndoHistory.length > 10) {
              tapUndoHistory.shift();
            }
          }
          hasPushedSequenceToHistory = true;
        }

        updateBpm(calculatedBpm, true);
        updateUndoTapButton();
      }
    }
  }

  // Tap button visual feedback
  const tapLabel = document.getElementById("tapSubtext");
  if (tapLabel) {
    tapLabel.textContent = "Tap " + tapTimestamps.length + " (BPM " + bpm + ")";
    clearTimeout(tapBtn._timeoutId);
    tapBtn._timeoutId = setTimeout(function () {
      tapLabel.textContent = "Tap to detect tempo";
    }, 2000);
  }
}

// Quick metronome banner (visible in Setlist & Tuner when metronome is playing)
function updateGlobalMetronomeBar() {
  const bar = document.getElementById("globalMetronomeBar");
  if (!bar) return;

  const isPlaying = (typeof isEnginePlaying === "function") ? isEnginePlaying() : false;
  const metronomeTab = document.getElementById("pills-metronome-tab");
  const isMetronomeTabActive = metronomeTab ? metronomeTab.classList.contains("active") : true;

  if (isPlaying && !isMetronomeTabActive) {
    bar.classList.remove("d-none");
    const infoEl = document.getElementById("globalMetronomeInfo");
    if (infoEl) {
      let songLabel = "";
      if (typeof getActivePlaylist === "function" && typeof currentSongIndex !== "undefined" && currentSongIndex >= 0) {
        const playlist = getActivePlaylist();
        if (playlist && playlist[currentSongIndex]) {
          songLabel = playlist[currentSongIndex].title + " • ";
        }
      }
      infoEl.textContent = songLabel + bpm + " BPM (" + timeSignature + "/4)";
    }
  } else {
    bar.classList.add("d-none");
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
    beatsAtCurrentTempo = 0;
    hasAddedCurrentTempoToHistory = false;

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
      if (dot) dot.classList.remove("active-beat", "active-beat-accent", "active-beat-normal");
    }
  } else {
    beatsAtCurrentTempo = 0;
    hasAddedCurrentTempoToHistory = false;
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

  updateGlobalMetronomeBar();
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

  // Global quick stop button (visible on Setlist and Tuner tabs)
  const globalStopBtn = document.getElementById("globalStopMetronomeBtn");
  if (globalStopBtn) {
    globalStopBtn.addEventListener("click", function () {
      if (isEnginePlaying()) {
        togglePlayMetronome();
      }
    });
  }

  // Global jump to metronome button
  const globalGoToBtn = document.getElementById("globalMetronomeGoToBtn");
  if (globalGoToBtn) {
    globalGoToBtn.addEventListener("click", function () {
      const metronomeTabBtn = document.getElementById("pills-metronome-tab");
      if (metronomeTabBtn) {
        metronomeTabBtn.click();
      }
    });
  }

  // Tap button
  const tapBtn = document.getElementById("tapButton");
  if (tapBtn) {
    tapBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      handleTapTempo();
    });
  }

  // Undo Tap button
  const undoTapBtn = document.getElementById("undoTapBtn");
  if (undoTapBtn) {
    undoTapBtn.addEventListener("click", function (e) {
      e.preventDefault();
      undoTappedBpm();
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
      beatsAtCurrentTempo = 0;
      hasAddedCurrentTempoToHistory = false;
    });
  }

  // Sound type select (Beep, Voice, Drum Kit, Woodblock, Cowbell, Mechanical, Rimshot, Off) & On/Off switch
  const soundSelect = document.getElementById("soundTypeSelect");
  const soundSwitch = document.getElementById("soundToggleSwitch");

  const savedSound = localStorage.getItem("metronome_sound_type") || "beep";
  if (savedSound !== "silent") {
    lastActiveSoundType = savedSound;
  }
  if (soundSelect) {
    soundSelect.value = savedSound;
  }
  if (soundSwitch) {
    soundSwitch.checked = (savedSound !== "silent");
  }
  setEngineSoundType(savedSound);

  if (soundSelect) {
    soundSelect.addEventListener("change", function () {
      const selectedSound = this.value;
      if (selectedSound !== "silent") {
        lastActiveSoundType = selectedSound;
      }
      if (soundSwitch) {
        soundSwitch.checked = (selectedSound !== "silent");
      }
      setEngineSoundType(selectedSound);
      localStorage.setItem("metronome_sound_type", selectedSound);
    });
  }

  if (soundSwitch) {
    soundSwitch.addEventListener("change", function () {
      const isSoundOn = this.checked;
      let targetSound = "silent";
      if (isSoundOn) {
        targetSound = (lastActiveSoundType && lastActiveSoundType !== "silent") ? lastActiveSoundType : "beep";
      }
      if (soundSelect) {
        soundSelect.value = targetSound;
      }
      setEngineSoundType(targetSound);
      localStorage.setItem("metronome_sound_type", targetSound);
    });
  }

  // Initialize Quick BPM presets
  loadQuickPresets();
  renderQuickPresets();

  const toggleSaveBtn = document.getElementById("toggleSavePresetBtn");
  if (toggleSaveBtn) {
    toggleSaveBtn.addEventListener("click", function () {
      toggleSavePresetMode();
    });
  }

  const resetPresetsBtn = document.getElementById("resetPresetsBtn");
  if (resetPresetsBtn) {
    resetPresetsBtn.addEventListener("click", function () {
      if (confirm("Reset the 6 quick presets to default values (140, 120, 110, 100, 90, 80)?")) {
        resetQuickPresets();
      }
    });
  }

  // Initialize Tempo History
  renderTempoHistory();

  const clearHistBtn = document.getElementById("clearHistoryBtn");
  if (clearHistBtn) {
    clearHistBtn.addEventListener("click", function () {
      if (confirm("Clear all recorded tempo history?")) {
        clearAllTempoHistory();
      }
    });
  }

  // Flash mode select & On/Off switch
  const flashSelect = document.getElementById("flashModeSelect");
  const flashSwitch = document.getElementById("flashToggleSwitch");

  const savedFlash = localStorage.getItem("metronome_flash_mode") || "vivid";
  flashMode = savedFlash;
  if (savedFlash !== "off") {
    lastActiveFlashMode = savedFlash;
  }
  if (flashSelect) {
    flashSelect.value = savedFlash;
  }
  if (flashSwitch) {
    flashSwitch.checked = (savedFlash !== "off");
  }

  if (flashSelect) {
    flashSelect.addEventListener("change", function () {
      const selectedFlash = this.value;
      flashMode = selectedFlash;
      if (selectedFlash !== "off") {
        lastActiveFlashMode = selectedFlash;
      }
      if (flashSwitch) {
        flashSwitch.checked = (selectedFlash !== "off");
      }
      localStorage.setItem("metronome_flash_mode", flashMode);
    });
  }

  if (flashSwitch) {
    flashSwitch.addEventListener("change", function () {
      const isFlashOn = this.checked;
      let targetFlash = "off";
      if (isFlashOn) {
        targetFlash = (lastActiveFlashMode && lastActiveFlashMode !== "off") ? lastActiveFlashMode : "vivid";
      }
      flashMode = targetFlash;
      if (flashSelect) {
        flashSelect.value = targetFlash;
      }
      localStorage.setItem("metronome_flash_mode", flashMode);
    });
  }

  // Accessibility Display Size scaling
  loadUiSizePreference();

  const uiSizeSelect = document.getElementById("uiSizeSelect");
  if (uiSizeSelect) {
    uiSizeSelect.value = currentUiSize;
    uiSizeSelect.addEventListener("change", function () {
      setUiSize(this.value);
    });
  }
}

// Display size accessibility management
const UI_SIZE_STORAGE_KEY = "groovepulse_ui_size_v1";
let currentUiSize = "large"; // Default to "large" for senior readability

function setUiSize(size) {
  currentUiSize = size || "large";
  document.body.classList.remove("ui-size-normal", "ui-size-large", "ui-size-xlarge");
  document.body.classList.add("ui-size-" + currentUiSize);
  try {
    localStorage.setItem(UI_SIZE_STORAGE_KEY, currentUiSize);
  } catch (e) {}

  const select = document.getElementById("uiSizeSelect");
  if (select && select.value !== currentUiSize) {
    select.value = currentUiSize;
  }
}

function loadUiSizePreference() {
  let saved = "large";
  try {
    saved = localStorage.getItem(UI_SIZE_STORAGE_KEY) || "large";
  } catch (e) {}
  setUiSize(saved);
}


