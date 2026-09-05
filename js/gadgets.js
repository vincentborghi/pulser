// Concert Gadgets Module for Audience / Spectator Stage Beacons
// Pure procedural implementation using Web APIs, Canvas, and CSS animations

let activeGadgetType = null;
let gadgetAnimFrameId = null;
let gadgetWakeLockSentinel = null;
let isGadgetRotated90 = false;
const DEFAULT_TICKER_PRESETS = [
  {
    id: "tp_bravo",
    name: "Bravo !",
    text: "BRAVO !",
    decorBefore: "👏",
    decorAfter: "",
    effect: "zoom",
    color: "#00d2ff",
    speed: 40
  },
  {
    id: "tp_love",
    name: "Love",
    text: "WE LOVE YOU",
    decorBefore: "❤️",
    decorAfter: "",
    effect: "rainbow",
    color: "#00e676",
    speed: 40
  },
  {
    id: "tp_une_autre",
    name: "Une autre !",
    text: "UNE AUTRE !",
    decorBefore: "🔥",
    decorAfter: "",
    effect: "wave_bounce",
    color: "#ff007f",
    speed: 50
  },
  {
    id: "tp_one_more",
    name: "One More !",
    text: "ONE MORE !",
    decorBefore: "⭐",
    decorAfter: "",
    effect: "scroll",
    color: "#ffcc00",
    speed: 40
  },
  {
    id: "tp_encore",
    name: "Encore !",
    text: "ENCORE !",
    decorBefore: "⚡",
    decorAfter: "",
    effect: "blink",
    color: "#ffcc00",
    speed: 65
  },
  {
    id: "tp_the_best",
    name: "The Best",
    text: "THE BEST",
    decorBefore: "👑",
    decorAfter: "",
    effect: "neon_flicker",
    color: "#ffcc00",
    speed: 40
  },
  {
    id: "tp_rock_solo",
    name: "Rock Solo",
    text: "SOLO !",
    decorBefore: "🤘",
    decorAfter: "",
    effect: "glitch_shake",
    color: "#ffffff",
    speed: 65
  },
  {
    id: "tp_boom",
    name: "Boom !",
    text: "BOOM !",
    decorBefore: "💥",
    decorAfter: "",
    effect: "disco_colors",
    color: "#ff3333",
    speed: 65
  },
  {
    id: "tp_awesome",
    name: "Awesome",
    text: "AWESOME !",
    decorBefore: "👍",
    decorAfter: "",
    effect: "scroll",
    color: "#ffea00",
    speed: 40
  }
];

let tickerPresets = [];
let activeTickerPresetId = localStorage.getItem("pulser_ticker_active_preset_id_v5") || "tp_bravo";
let customTickerText = "👏 BRAVO !";
let customTickerColor = "#00d2ff"; // Electric cyan
let customTickerSpeed = 40; // Speed factor
let customTickerEffect = "zoom";
let currentFlameVariant = localStorage.getItem("pulser_flame_variant") || "candle";

// Wake lock to keep smartphone screen on at 100% while held in the air
async function requestGadgetWakeLock() {
  if ("wakeLock" in navigator) {
    try {
      gadgetWakeLockSentinel = await navigator.wakeLock.request("screen");
      gadgetWakeLockSentinel.addEventListener("release", function () {
        gadgetWakeLockSentinel = null;
      });
    } catch (err) {
      console.warn("Gadget WakeLock could not be acquired:", err);
    }
  }
}

async function releaseGadgetWakeLock() {
  if (gadgetWakeLockSentinel !== null) {
    try {
      await gadgetWakeLockSentinel.release();
    } catch (err) {
      console.warn("Gadget WakeLock release error:", err);
    }
    gadgetWakeLockSentinel = null;
  }
}

// Request browser full screen to force mobile Chrome to hide URL and navigation bars
function requestBrowserFullscreen() {
  try {
    const docEl = document.documentElement;
    const rfs = docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    if (rfs && !document.fullscreenElement && !document.webkitFullscreenElement) {
      const p = rfs.call(docEl);
      if (p && typeof p.catch === "function") {
        p.catch(function () {});
      }
    }
  } catch (err) {
    // Ignore if not permitted
  }

  // Fallback for mobile browser address bar collapse
  try {
    window.scrollTo(0, 1);
  } catch (e) {}
}

function exitBrowserFullscreen() {
  try {
    const doc = document;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
    if (isFs) {
      const efs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (efs) {
        const p = efs.call(doc);
        if (p && typeof p.catch === "function") {
          p.catch(function () {});
        }
      }
    }
  } catch (err) {
    // Ignore
  }
}

function loadTickerPresets() {
  try {
    const raw = localStorage.getItem("pulser_ticker_presets_v5");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        tickerPresets = parsed;
        return;
      }
    }
  } catch (err) {
    console.warn("Could not load ticker presets from storage:", err);
  }
  tickerPresets = JSON.parse(JSON.stringify(DEFAULT_TICKER_PRESETS));
  saveTickerPresets();
}

function saveTickerPresets() {
  try {
    localStorage.setItem("pulser_ticker_presets_v5", JSON.stringify(tickerPresets));
  } catch (err) {
    console.warn("Could not save ticker presets to storage:", err);
  }
}

function getActiveTickerPreset() {
  const found = tickerPresets.find(function (p) {
    return p.id === activeTickerPresetId;
  });
  return found || tickerPresets[0] || null;
}

function renderTickerPresetsUI() {
  const presetSelect = document.getElementById("tickerPresetSelect");
  const chipsContainer = document.getElementById("tickerPresetChips");

  if (presetSelect) {
    presetSelect.innerHTML = "";
    tickerPresets.forEach(function (preset) {
      const opt = document.createElement("option");
      opt.value = preset.id;
      const decor = preset.decorBefore ? preset.decorBefore + " " : "";
      opt.textContent = decor + preset.name;
      if (preset.id === activeTickerPresetId) {
        opt.selected = true;
      }
      presetSelect.appendChild(opt);
    });
  }

  if (chipsContainer) {
    chipsContainer.innerHTML = "";
    tickerPresets.forEach(function (preset) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm py-0 px-2 text-nowrap " + (preset.id === activeTickerPresetId ? "btn-primary text-white fw-bold" : "btn-outline-secondary text-white");
      btn.style.fontSize = "0.78rem";
      const decor = preset.decorBefore ? preset.decorBefore + " " : "";
      btn.textContent = decor + preset.name;
      btn.addEventListener("click", function () {
        applyTickerPreset(preset.id);
      });
      chipsContainer.appendChild(btn);
    });
  }

  const activePreset = getActiveTickerPreset();
  if (activePreset) {
    populateTickerInputs(activePreset);
  }
}

function populateTickerInputs(preset) {
  const textInput = document.getElementById("customTextInput");
  const decorBeforeSelect = document.getElementById("tickerDecorBeforeSelect");
  const decorAfterSelect = document.getElementById("tickerDecorAfterSelect");
  const effectSelect = document.getElementById("tickerEffectSelect");
  const colorSelect = document.getElementById("customTextColorSelect");
  const speedSelect = document.getElementById("customTextSpeedSelect");

  if (textInput) textInput.value = preset.text || "";
  if (decorBeforeSelect) decorBeforeSelect.value = preset.decorBefore !== undefined ? preset.decorBefore : "";
  if (decorAfterSelect) decorAfterSelect.value = preset.decorAfter !== undefined ? preset.decorAfter : "";
  if (effectSelect) effectSelect.value = preset.effect || "scroll";
  if (colorSelect) colorSelect.value = preset.color || "#ffcc00";
  if (speedSelect) speedSelect.value = String(preset.speed || 40);

  updateTickerPreview();
}

function applyTickerPreset(presetId) {
  activeTickerPresetId = presetId;
  try {
    localStorage.setItem("pulser_ticker_active_preset_id_v5", presetId);
  } catch (e) {}
  renderTickerPresetsUI();
}

function updateTickerPreview() {
  const textInput = document.getElementById("customTextInput");
  const decorBeforeSelect = document.getElementById("tickerDecorBeforeSelect");
  const decorAfterSelect = document.getElementById("tickerDecorAfterSelect");
  const effectSelect = document.getElementById("tickerEffectSelect");
  const colorSelect = document.getElementById("customTextColorSelect");
  const previewBar = document.getElementById("tickerPreviewBar");

  const rawText = textInput ? textInput.value.trim() : "";
  const decorBefore = decorBeforeSelect ? decorBeforeSelect.value : "";
  const decorAfter = decorAfterSelect ? decorAfterSelect.value : "";
  const color = colorSelect ? colorSelect.value : "#ffcc00";

  const fullText = [decorBefore, rawText, decorAfter].filter(Boolean).join(" ");

  if (previewBar) {
    previewBar.textContent = fullText || "";
    previewBar.style.color = color;
    previewBar.style.textShadow = "0 0 10px " + color;
  }
}

function saveCurrentAsActivePreset() {
  const textInput = document.getElementById("customTextInput");
  const decorBeforeSelect = document.getElementById("tickerDecorBeforeSelect");
  const decorAfterSelect = document.getElementById("tickerDecorAfterSelect");
  const effectSelect = document.getElementById("tickerEffectSelect");
  const colorSelect = document.getElementById("customTextColorSelect");
  const speedSelect = document.getElementById("customTextSpeedSelect");
  const toast = document.getElementById("tickerSavedToast");

  const activePreset = getActiveTickerPreset();
  if (!activePreset) return;

  activePreset.text = textInput ? textInput.value.trim() : "";
  activePreset.decorBefore = decorBeforeSelect ? decorBeforeSelect.value : "";
  activePreset.decorAfter = decorAfterSelect ? decorAfterSelect.value : "";
  activePreset.effect = effectSelect ? effectSelect.value : "scroll";
  activePreset.color = colorSelect ? colorSelect.value : "#ffcc00";
  activePreset.speed = speedSelect ? parseInt(speedSelect.value, 10) || 40 : 40;

  saveTickerPresets();
  renderTickerPresetsUI();

  if (toast) {
    toast.classList.remove("d-none");
    setTimeout(function () {
      toast.classList.add("d-none");
    }, 1200);
  }
}

function createNewTickerPreset() {
  const name = prompt("Enter a name for the new preset:", "My Message");
  if (!name || !name.trim()) return;

  const textInput = document.getElementById("customTextInput");
  const decorBeforeSelect = document.getElementById("tickerDecorBeforeSelect");
  const decorAfterSelect = document.getElementById("tickerDecorAfterSelect");
  const effectSelect = document.getElementById("tickerEffectSelect");
  const colorSelect = document.getElementById("customTextColorSelect");
  const speedSelect = document.getElementById("customTextSpeedSelect");

  const newId = "tp_" + Date.now();
  const newPreset = {
    id: newId,
    name: name.trim(),
    text: textInput ? textInput.value.trim() : "",
    decorBefore: decorBeforeSelect ? decorBeforeSelect.value : "⭐",
    decorAfter: decorAfterSelect ? decorAfterSelect.value : "",
    effect: effectSelect ? effectSelect.value : "scroll",
    color: colorSelect ? colorSelect.value : "#ffcc00",
    speed: speedSelect ? parseInt(speedSelect.value, 10) || 40 : 40
  };

  tickerPresets.push(newPreset);
  activeTickerPresetId = newId;
  saveTickerPresets();
  try {
    localStorage.setItem("pulser_ticker_active_preset_id_v5", newId);
  } catch (e) {}

  renderTickerPresetsUI();
}

function deleteCurrentTickerPreset() {
  if (tickerPresets.length <= 1) {
    alert("Cannot delete the last remaining preset.");
    return;
  }

  const activePreset = getActiveTickerPreset();
  if (!activePreset) return;

  if (confirm("Delete preset '" + activePreset.name + "'?")) {
    tickerPresets = tickerPresets.filter(function (p) {
      return p.id !== activePreset.id;
    });
    activeTickerPresetId = tickerPresets[0].id;
    saveTickerPresets();
    try {
      localStorage.setItem("pulser_ticker_active_preset_id_v5", activeTickerPresetId);
    } catch (e) {}
    renderTickerPresetsUI();
  }
}

function initGadgets() {
  // Initialize ticker presets
  loadTickerPresets();
  renderTickerPresetsUI();

  // Wire preset selector
  const presetSelect = document.getElementById("tickerPresetSelect");
  if (presetSelect) {
    presetSelect.addEventListener("change", function () {
      applyTickerPreset(presetSelect.value);
    });
  }

  // Wire Save, New, Delete preset buttons
  const savePresetBtn = document.getElementById("saveTickerPresetBtn");
  if (savePresetBtn) {
    savePresetBtn.addEventListener("click", function () {
      saveCurrentAsActivePreset();
    });
  }

  const newPresetBtn = document.getElementById("newTickerPresetBtn");
  if (newPresetBtn) {
    newPresetBtn.addEventListener("click", function () {
      createNewTickerPreset();
    });
  }

  const deletePresetBtn = document.getElementById("deleteTickerPresetBtn");
  if (deletePresetBtn) {
    deletePresetBtn.addEventListener("click", function () {
      deleteCurrentTickerPreset();
    });
  }

  // Wire live preview input listeners
  const customTextInput = document.getElementById("customTextInput");
  if (customTextInput) {
    customTextInput.addEventListener("input", function () {
      updateTickerPreview();
    });
  }

  const decorBeforeSelect = document.getElementById("tickerDecorBeforeSelect");
  if (decorBeforeSelect) {
    decorBeforeSelect.addEventListener("change", function () {
      updateTickerPreview();
    });
  }

  const decorAfterSelect = document.getElementById("tickerDecorAfterSelect");
  if (decorAfterSelect) {
    decorAfterSelect.addEventListener("change", function () {
      updateTickerPreview();
    });
  }

  const effectSelect = document.getElementById("tickerEffectSelect");
  if (effectSelect) {
    effectSelect.addEventListener("change", function () {
      updateTickerPreview();
    });
  }

  const colorSelect = document.getElementById("customTextColorSelect");
  if (colorSelect) {
    colorSelect.addEventListener("change", function () {
      updateTickerPreview();
    });
  }

  const speedSelect = document.getElementById("customTextSpeedSelect");
  if (speedSelect) {
    speedSelect.addEventListener("change", function () {
      updateTickerPreview();
    });
  }

  // Launch buttons
  const launchCandleBtn = document.getElementById("launchCandleBtn");
  if (launchCandleBtn) {
    launchCandleBtn.addEventListener("click", function () {
      openConcertGadget("candle");
    });
  }


  const launchCustomTextBtn = document.getElementById("launchCustomTextBtn");
  if (launchCustomTextBtn) {
    launchCustomTextBtn.addEventListener("click", function () {
      const input = document.getElementById("customTextInput");
      const decorBeforeSelect = document.getElementById("tickerDecorBeforeSelect");
      const decorAfterSelect = document.getElementById("tickerDecorAfterSelect");
      const colorSelect = document.getElementById("customTextColorSelect");
      const speedSelect = document.getElementById("customTextSpeedSelect");
      const effectSelect = document.getElementById("tickerEffectSelect");

      const baseText = input ? input.value.trim() : "";
      const decorBefore = decorBeforeSelect ? decorBeforeSelect.value : "";
      const decorAfter = decorAfterSelect ? decorAfterSelect.value : "";

      customTickerText = [decorBefore, baseText, decorAfter].filter(Boolean).join(" ");
      if (!customTickerText) {
        customTickerText = "⭐";
      }
      if (colorSelect) customTickerColor = colorSelect.value;
      if (speedSelect) customTickerSpeed = parseInt(speedSelect.value, 10) || 40;
      if (effectSelect) customTickerEffect = effectSelect.value;

      openConcertGadget("custom_text");
    });

    const tickerPreviewBar = document.getElementById("tickerPreviewBar");
    if (tickerPreviewBar) {
      tickerPreviewBar.addEventListener("click", function () {
        launchCustomTextBtn.click();
      });
    }
  }

  const launchGlowstickBtn = document.getElementById("launchGlowstickBtn");
  if (launchGlowstickBtn) {
    launchGlowstickBtn.addEventListener("click", function () {
      openConcertGadget("glowstick");
    });
  }

  const launchHeartBtn = document.getElementById("launchHeartBtn");
  if (launchHeartBtn) {
    launchHeartBtn.addEventListener("click", function () {
      openConcertGadget("heart");
    });
  }

  // Flame style variant buttons (Candle vs Bic Lighter)
  const candleVariantBtn = document.getElementById("flameVariantCandleBtn");
  if (candleVariantBtn) {
    candleVariantBtn.addEventListener("click", function () {
      setFlameVariant("candle");
    });
  }

  const lighterVariantBtn = document.getElementById("flameVariantLighterBtn");
  if (lighterVariantBtn) {
    lighterVariantBtn.addEventListener("click", function () {
      setFlameVariant("lighter");
    });
  }

  // Fullscreen overlay controls
  const overlay = document.getElementById("concertGadgetOverlay");
  const closeBtn = document.getElementById("closeGadgetOverlayBtn");
  const rotateBtn = document.getElementById("rotateGadgetOverlayBtn");
  const switchFlameBtn = document.getElementById("switchFlameVariantBtn");

  if (closeBtn) {
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeConcertGadget();
    });
  }

  if (rotateBtn) {
    rotateBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleGadgetRotation();
    });
  }

  if (switchFlameBtn) {
    switchFlameBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setFlameVariant(currentFlameVariant === "candle" ? "lighter" : "candle");
    });
  }

  // Initialize UI variant buttons
  setFlameVariant(currentFlameVariant);

  if (overlay) {
    overlay.addEventListener("click", function (e) {
      const target = e.target;
      if (target && target.closest("#gadgetOverlayControls")) {
        return;
      }
      // Re-hide Chrome address bar if it was restored
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        requestBrowserFullscreen();
      }
      toggleGadgetControlsHint();
    });
  }

  // Keyboard shortcut: Escape key closes active gadget
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && activeGadgetType !== null) {
      closeConcertGadget();
    }
  });
}

function setFlameVariant(variant) {
  currentFlameVariant = variant;
  try {
    localStorage.setItem("pulser_flame_variant", variant);
  } catch (e) {}

  const candleBtn = document.getElementById("flameVariantCandleBtn");
  const lighterBtn = document.getElementById("flameVariantLighterBtn");
  const icon = document.getElementById("flameGadgetIcon");

  if (candleBtn && lighterBtn) {
    if (variant === "candle") {
      candleBtn.classList.add("active", "bg-warning", "text-dark");
      lighterBtn.classList.remove("active", "bg-warning", "text-dark");
      if (icon) icon.textContent = "🕯️";
    } else {
      lighterBtn.classList.add("active", "bg-warning", "text-dark");
      candleBtn.classList.remove("active", "bg-warning", "text-dark");
      if (icon) icon.textContent = "🔥";
    }
  }

  const switchLabel = document.getElementById("switchFlameVariantLabel");
  if (switchLabel) {
    switchLabel.textContent = variant === "candle" ? "🔥 Bic" : "🕯️ Candle";
  }

  if (activeGadgetType === "candle") {
    const stage = document.getElementById("gadgetStageContainer");
    if (stage) {
      startCandleFlame(stage);
    }
  }
}

function openConcertGadget(type) {
  const overlay = document.getElementById("concertGadgetOverlay");
  const stage = document.getElementById("gadgetStageContainer");
  const controls = document.getElementById("gadgetOverlayControls");
  if (!overlay || !stage) return;

  activeGadgetType = type;
  stage.innerHTML = "";
  overlay.classList.remove("d-none");

  // Toggle variant switch button in controls
  const switchFlameBtn = document.getElementById("switchFlameVariantBtn");
  if (switchFlameBtn) {
    if (type === "candle") {
      switchFlameBtn.classList.remove("d-none");
      const switchLabel = document.getElementById("switchFlameVariantLabel");
      if (switchLabel) {
        switchLabel.textContent = currentFlameVariant === "candle" ? "🔥 Bic" : "🕯️ Candle";
      }
    } else {
      switchFlameBtn.classList.add("d-none");
    }
  }

  // Keep screen awake
  requestGadgetWakeLock();

  // Request browser full screen to force mobile Chrome to hide URL and navigation bars
  requestBrowserFullscreen();
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  // Show top controls and temporary hint briefly upon opening, then auto-fade after 4000ms
  if (controls) {
    controls.classList.remove("fade-out");
    controls.style.opacity = "1";
    clearTimeout(controlsHintTimeout);
    controlsHintTimeout = setTimeout(function () {
      controls.classList.add("fade-out");
    }, 4000);
  }

  // Push overlay state to history so browser Back closes the gadget
  try {
    history.pushState({ pulser: "overlay", gadget: type }, "");
  } catch (err) {}

  if (type === "candle") {
    startCandleFlame(stage);
  } else if (type === "custom_text") {
    startCustomTextMarquee(stage, customTickerText, customTickerColor, customTickerSpeed, customTickerEffect);
  } else if (type === "glowstick") {
    startGlowstick(stage);
  } else if (type === "heart") {
    startPulsingHeart(stage);
  }
}

function closeConcertGadget(fromHistoryPop) {
  if (controlsHintTimeout !== null) {
    clearTimeout(controlsHintTimeout);
    controlsHintTimeout = null;
  }

  if (candleInteractiveCleanup !== null) {
    candleInteractiveCleanup();
  }

  stopGlowstickRainbow();

  if (gadgetAnimFrameId !== null) {
    cancelAnimationFrame(gadgetAnimFrameId);
    gadgetAnimFrameId = null;
  }

  const overlay = document.getElementById("concertGadgetOverlay");
  const stage = document.getElementById("gadgetStageContainer");

  if (overlay) overlay.classList.add("d-none");
  if (stage) stage.innerHTML = "";

  activeGadgetType = null;
  releaseGadgetWakeLock();
  exitBrowserFullscreen();
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";

  // If closed via UI action and not popstate, pop the overlay history entry
  if (!fromHistoryPop) {
    try {
      if (history.state && history.state.pulser === "overlay") {
        history.back();
      }
    } catch (err) {}
  }
}

function toggleGadgetRotation() {
  isGadgetRotated90 = !isGadgetRotated90;
  const stage = document.getElementById("gadgetStageContainer");
  const rotateIcon = document.getElementById("rotateGadgetIcon");

  if (stage) {
    if (isGadgetRotated90) {
      stage.classList.add("rotated-stage-90");
    } else {
      stage.classList.remove("rotated-stage-90");
    }
  }

  if (rotateIcon) {
    rotateIcon.className = isGadgetRotated90 ? "bi bi-phone text-warning" : "bi bi-phone-landscape text-white";
  }
}

let controlsHintTimeout = null;
function toggleGadgetControlsHint() {
  const controls = document.getElementById("gadgetOverlayControls");
  if (!controls) return;

  if (controls.style.opacity === "0" || controls.classList.contains("fade-out")) {
    controls.classList.remove("fade-out");
    controls.style.opacity = "1";
    clearTimeout(controlsHintTimeout);
    controlsHintTimeout = setTimeout(function () {
      controls.classList.add("fade-out");
    }, 4000);
  } else {
    controls.classList.add("fade-out");
    clearTimeout(controlsHintTimeout);
  }
}

// --- GADGET 1: CONCERT CANDLE / LIGHTER FLAME ---
let candleInteractiveCleanup = null;

function startCandleFlame(container) {
  if (candleInteractiveCleanup !== null) {
    candleInteractiveCleanup();
  }

  if (currentFlameVariant === "lighter") {
    container.innerHTML = `
      <div class="candle-wrapper text-center">
        <div class="candle-halo" style="transform: translate(-55%, -65%);"></div>
        <div class="bic-assembly">
          <div class="bic-flame-anchor" id="interactiveCandleAnchor">
            <div class="candle-flame">
              <div class="flame-outer"></div>
              <div class="flame-inner"></div>
              <div class="flame-core"></div>
              <div class="flame-base-blue"></div>
            </div>
          </div>

          <svg class="bic-svg" width="260" height="290" viewBox="0 0 260 290" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bicBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#002d6e"/>
                <stop offset="20%" stop-color="#004bb5"/>
                <stop offset="55%" stop-color="#1973ff"/>
                <stop offset="85%" stop-color="#0043a4"/>
                <stop offset="100%" stop-color="#00255c"/>
              </linearGradient>
              <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#334155"/>
                <stop offset="15%" stop-color="#cbd5e1"/>
                <stop offset="45%" stop-color="#ffffff"/>
                <stop offset="75%" stop-color="#94a3b8"/>
                <stop offset="100%" stop-color="#1e293b"/>
              </linearGradient>
              <linearGradient id="wheelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#64748b"/>
                <stop offset="50%" stop-color="#94a3b8"/>
                <stop offset="100%" stop-color="#1e293b"/>
              </linearGradient>
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f5caa8"/>
                <stop offset="40%" stop-color="#e2a47d"/>
                <stop offset="80%" stop-color="#c57b50"/>
                <stop offset="100%" stop-color="#9e5630"/>
              </linearGradient>
              <linearGradient id="nailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#fcd8c4"/>
                <stop offset="55%" stop-color="#fde8dd"/>
                <stop offset="100%" stop-color="#f4be9f"/>
              </linearGradient>
            </defs>

            <!-- Fingers wrapping from behind holding lighter -->
            <path d="M 52 165 C 52 155, 68 155, 68 168 C 68 180, 52 180, 52 165 Z" fill="#b06c45"/>
            <path d="M 50 195 C 50 185, 68 185, 68 198 C 68 210, 50 210, 50 195 Z" fill="#9e5b35"/>
            <path d="M 50 225 C 50 215, 68 215, 68 228 C 68 240, 50 240, 50 225 Z" fill="#8d4d29"/>

            <!-- Lighter Main Body -->
            <rect x="66" y="96" width="76" height="185" rx="15" ry="15" fill="url(#bicBodyGrad)"/>
            <line x1="82" y1="100" x2="82" y2="276" stroke="rgba(255,255,255,0.4)" stroke-width="4" stroke-linecap="round"/>
            <line x1="126" y1="102" x2="126" y2="274" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linecap="round"/>

            <!-- Metal Hood (Windguard) -->
            <path d="M 70 96 L 70 42 Q 70 36 77 36 L 115 36 Q 122 36 122 42 L 122 96 Z" fill="url(#chromeGrad)"/>
            <rect x="76" y="46" width="6.5" height="22" rx="3.2" fill="#0f172a"/>
            <rect x="87" y="46" width="6.5" height="30" rx="3.2" fill="#0f172a"/>
            <rect x="98" y="46" width="6.5" height="30" rx="3.2" fill="#0f172a"/>
            <rect x="109" y="46" width="6" height="22" rx="3" fill="#0f172a"/>

            <!-- Spark Wheel (Serrated) -->
            <rect x="115" y="48" width="20" height="30" rx="3" fill="url(#wheelGrad)" stroke="#1e293b" stroke-width="1.2"/>
            <line x1="115" y1="54" x2="135" y2="54" stroke="#0f172a" stroke-width="1.8"/>
            <line x1="115" y1="60" x2="135" y2="60" stroke="#0f172a" stroke-width="1.8"/>
            <line x1="115" y1="66" x2="135" y2="66" stroke="#0f172a" stroke-width="1.8"/>
            <line x1="115" y1="72" x2="135" y2="72" stroke="#0f172a" stroke-width="1.8"/>

            <!-- Pressed Red Gas Lever / Fork -->
            <path d="M 128 72 L 158 81 L 155 102 L 128 94 Z" fill="#dc2626"/>

            <!-- Human Thumb pressing down firmly on the lever -->
            <path d="M 138 150 Q 165 155, 180 190 Q 192 230, 204 290 L 138 290 Z" fill="url(#skinGrad)"/>
            <path d="M 124 75 C 130 66, 150 66, 160 73 C 174 82, 186 102, 188 124 C 190 148, 183 174, 174 196 C 164 176, 155 148, 146 122 C 142 106, 132 85, 124 75 Z" fill="url(#skinGrad)" stroke="#8d4a24" stroke-width="1.2"/>
            <ellipse cx="140" cy="77" rx="16" ry="10" transform="rotate(14 140 77)" fill="#e59870"/>
            <path d="M 145 71 C 152 68, 162 72, 163 79 C 164 86, 156 92, 149 91 C 143 89, 140 78, 145 71 Z" fill="url(#nailGrad)" stroke="#aa6038" stroke-width="1"/>
            <path d="M 148 74 Q 155 72, 159 77" stroke="#ffffff" stroke-width="1.4" fill="none" stroke-linecap="round"/>
            <path d="M 158 116 Q 166 118, 172 114" stroke="#8d4a24" stroke-width="1.3" fill="none" stroke-linecap="round"/>
            <path d="M 159 122 Q 167 124, 173 120" stroke="#8d4a24" stroke-width="1.3" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="candle-wrapper text-center">
        <div class="candle-halo"></div>
        <div class="candle-flame-anchor" id="interactiveCandleAnchor">
          <div class="candle-flame">
            <div class="flame-outer"></div>
            <div class="flame-inner"></div>
            <div class="flame-core"></div>
            <div class="flame-base-blue"></div>
          </div>
        </div>
        <div class="candle-wick"></div>
        <div class="candle-body">
          <div class="candle-glow-reflection"></div>
        </div>
      </div>
    `;
  }

  const anchorElem = container.querySelector("#interactiveCandleAnchor");
  if (!anchorElem) return;

  let currentTilt = 0;
  let targetTilt = 0;
  let animId = null;

  function updateFlameTilt() {
    currentTilt += (targetTilt - currentTilt) * 0.12;
    if (anchorElem) {
      anchorElem.style.transform = `rotate(${currentTilt.toFixed(1)}deg)`;
    }
    animId = requestAnimationFrame(updateFlameTilt);
  }
  animId = requestAnimationFrame(updateFlameTilt);

  function handlePointerMove(e) {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    targetTilt = Math.max(-20, Math.min(20, deltaX * 20));
  }

  function handlePointerUp() {
    targetTilt = 0;
  }

  function handleOrientation(e) {
    if (e.gamma !== null && e.gamma !== undefined) {
      targetTilt = Math.max(-24, Math.min(24, e.gamma * 0.7));
    }
  }

  container.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
  window.addEventListener("deviceorientation", handleOrientation);

  candleInteractiveCleanup = function () {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    container.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    window.removeEventListener("deviceorientation", handleOrientation);
    candleInteractiveCleanup = null;
  };
}

// --- GADGET 2: LED BANNER & VISUAL EFFECTS (LANDSCAPE) ---
function startCustomTextMarquee(container, text, colorHex, speedLevel, effect) {
  const rawText = text !== undefined && text !== null ? String(text).trim() : "";
  const cleanText = (rawText || "⭐").toUpperCase();
  const activeEffect = effect || "scroll";
  const speed = speedLevel || 40;

  // Calculate speed durations for CSS animations
  let animDuration = "1.0s";
  if (activeEffect === "zoom" || activeEffect === "zoom_blink") {
    animDuration = speed >= 60 ? "0.65s" : speed <= 30 ? "1.5s" : "1.0s";
  } else if (activeEffect === "blink") {
    animDuration = speed >= 60 ? "0.35s" : speed <= 30 ? "1.1s" : "0.65s";
  } else if (activeEffect === "rainbow") {
    animDuration = speed >= 60 ? "1.5s" : speed <= 30 ? "4.0s" : "2.5s";
  } else if (activeEffect === "neon_flicker") {
    animDuration = speed >= 60 ? "1.1s" : speed <= 30 ? "2.6s" : "1.8s";
  } else if (activeEffect === "glitch_shake") {
    animDuration = speed >= 60 ? "0.5s" : speed <= 30 ? "1.2s" : "0.8s";
  } else if (activeEffect === "wave_bounce") {
    animDuration = speed >= 60 ? "0.6s" : speed <= 30 ? "1.4s" : "0.9s";
  } else if (activeEffect === "disco_colors") {
    animDuration = speed >= 60 ? "0.7s" : speed <= 30 ? "1.8s" : "1.2s";
  }

  if (activeEffect === "scroll") {
    const durationSec = Math.max(4, Math.round((cleanText.length * 15) / speed));
    container.innerHTML = `
      <div class="ticker-wrapper w-100 h-100 d-flex align-items-center overflow-hidden">
        <div class="ticker-track" style="animation-duration: ${durationSec}s;">
          <span class="ticker-item" style="color: ${colorHex}; text-shadow: 0 0 20px ${colorHex}, 0 0 45px ${colorHex};">
            ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; 
          </span>
          <span class="ticker-item" style="color: ${colorHex}; text-shadow: 0 0 20px ${colorHex}, 0 0 45px ${colorHex};">
            ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; 
          </span>
        </div>
      </div>
    `;
  } else {
    // Static, Zoom Pulse, Strobe Blink, Zoom+Blink, or Rainbow Glow
    const effectClass = "ticker-effect-" + activeEffect;
    container.innerHTML = `
      <div class="banner-wrapper w-100 h-100 d-flex justify-content-center align-items-center p-3">
        <div class="giant-static-text ${effectClass}" style="color: ${colorHex}; text-shadow: 0 0 25px ${colorHex}, 0 0 60px ${colorHex}; --ticker-anim-speed: ${animDuration};">
          ${escapeHtml(cleanText)}
        </div>
      </div>
    `;
  }
}

// --- GADGET 4: NEON GLOWSTICK (PORTRAIT) ---
let glowstickRainbowAnimId = null;
let glowstickRainbowHue = 0;
let glowstickCurrentMode = "color";
let glowstickCurrentColor = "#00e676";

function stopGlowstickRainbow() {
  if (glowstickRainbowAnimId !== null) {
    cancelAnimationFrame(glowstickRainbowAnimId);
    glowstickRainbowAnimId = null;
  }
}

function updateGlowstickActiveButton(activeColor) {
  const btns = document.querySelectorAll(".glow-color-btn");
  btns.forEach(function (btn) {
    if (btn.getAttribute("data-color") === activeColor) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function setGlowstickColor(colorHex) {
  stopGlowstickRainbow();
  glowstickCurrentMode = "color";
  glowstickCurrentColor = colorHex;
  updateGlowstickActiveButton(colorHex);
  const wrapper = document.querySelector(".glowstick-wrapper");
  if (wrapper) {
    wrapper.style.setProperty("--glow-color", colorHex);
  }
}

function setGlowstickRainbowMode() {
  stopGlowstickRainbow();
  glowstickCurrentMode = "rainbow";
  updateGlowstickActiveButton("rainbow");
  const wrapper = document.querySelector(".glowstick-wrapper");
  if (!wrapper) return;

  function cycleStep() {
    glowstickRainbowHue = (glowstickRainbowHue + 1.2) % 360;
    const color = "hsl(" + Math.round(glowstickRainbowHue) + ", 100%, 50%)";
    wrapper.style.setProperty("--glow-color", color);
    glowstickRainbowAnimId = requestAnimationFrame(cycleStep);
  }
  glowstickRainbowAnimId = requestAnimationFrame(cycleStep);
}

function startGlowstick(container) {
  stopGlowstickRainbow();
  container.innerHTML = `
    <div class="glowstick-wrapper w-100 h-100 d-flex flex-column justify-content-center align-items-center" style="--glow-color: ${glowstickCurrentColor};">
      <div class="glowstick-halo"></div>
      <div class="glowstick-tube">
        <div class="glowstick-liquid">
          <div class="glowstick-core"></div>
          <div class="glowstick-glass-shine"></div>
        </div>
      </div>
      <div class="glowstick-controls d-flex justify-content-center align-items-center gap-3">
        <button type="button" class="btn rounded-circle glow-color-btn ${glowstickCurrentColor === "#00e676" && glowstickCurrentMode !== "rainbow" ? "active" : ""}" data-color="#00e676" style="background-color: #00e676;" title="Neon Green" onclick="event.stopPropagation(); setGlowstickColor('#00e676');"></button>
        <button type="button" class="btn rounded-circle glow-color-btn ${glowstickCurrentColor === "#00d2ff" && glowstickCurrentMode !== "rainbow" ? "active" : ""}" data-color="#00d2ff" style="background-color: #00d2ff;" title="Electric Cyan" onclick="event.stopPropagation(); setGlowstickColor('#00d2ff');"></button>
        <button type="button" class="btn rounded-circle glow-color-btn ${glowstickCurrentColor === "#ff007f" && glowstickCurrentMode !== "rainbow" ? "active" : ""}" data-color="#ff007f" style="background-color: #ff007f;" title="Magenta Pink" onclick="event.stopPropagation(); setGlowstickColor('#ff007f');"></button>
        <button type="button" class="btn rounded-circle glow-color-btn ${glowstickCurrentColor === "#ffeb3b" && glowstickCurrentMode !== "rainbow" ? "active" : ""}" data-color="#ffeb3b" style="background-color: #ffeb3b;" title="Amber Yellow" onclick="event.stopPropagation(); setGlowstickColor('#ffeb3b');"></button>
        <button type="button" class="btn rounded-circle glow-color-btn rainbow-btn ${glowstickCurrentMode === "rainbow" ? "active" : ""}" data-color="rainbow" style="background: conic-gradient(#ff0055, #ffaa00, #00e676, #00d2ff, #aa00ff, #ff0055);" title="Changing Colors (Rainbow)" onclick="event.stopPropagation(); setGlowstickRainbowMode();">
          <i class="bi bi-arrow-repeat text-white fw-bold" style="font-size: 1.1rem; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));"></i>
        </button>
      </div>
    </div>
  `;

  if (glowstickCurrentMode === "rainbow") {
    setGlowstickRainbowMode();
  }
}

// --- GADGET 5: PULSING HEART (FOR SLOW SONGS / BALLADS) ---
function startPulsingHeart(container) {
  container.innerHTML = `
    <div class="heart-wrapper w-100 h-100 d-flex flex-column justify-content-center align-items-center">
      <div class="pulsing-heart-icon">❤️</div>
      <div class="heart-ambient-glow"></div>
    </div>
  `;
}

function getActiveGadgetType() {
  return activeGadgetType;
}
