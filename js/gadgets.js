// Concert Gadgets Module for Audience / Spectator Stage Beacons
// Pure procedural implementation using Web APIs, Canvas, and CSS animations

let activeGadgetType = null;
let gadgetAnimFrameId = null;
let gadgetWakeLockSentinel = null;
let isGadgetRotated90 = false;
let customTickerText = "ONE MORE !";
let customTickerColor = "#ffcc00"; // Golden amber
let customTickerSpeed = 40; // Pixels per frame
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

function initGadgets() {
  // Wire preset buttons for custom text
  const quickButtons = document.querySelectorAll(".quick-text-preset");
  quickButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const input = document.getElementById("customTextInput");
      if (input) {
        input.value = btn.getAttribute("data-text") || "";
      }
    });
  });

  // Launch buttons
  const launchCandleBtn = document.getElementById("launchCandleBtn");
  if (launchCandleBtn) {
    launchCandleBtn.addEventListener("click", function () {
      openConcertGadget("candle");
    });
  }

  const launchBravoBtn = document.getElementById("launchBravoBtn");
  if (launchBravoBtn) {
    launchBravoBtn.addEventListener("click", function () {
      openConcertGadget("bravo");
    });
  }

  const launchCustomTextBtn = document.getElementById("launchCustomTextBtn");
  if (launchCustomTextBtn) {
    launchCustomTextBtn.addEventListener("click", function () {
      const input = document.getElementById("customTextInput");
      const colorSelect = document.getElementById("customTextColorSelect");
      const speedSelect = document.getElementById("customTextSpeedSelect");

      if (input && input.value.trim()) {
        customTickerText = input.value.trim();
      } else {
        customTickerText = "ONE MORE !";
      }

      if (colorSelect) customTickerColor = colorSelect.value;
      if (speedSelect) customTickerSpeed = parseInt(speedSelect.value, 10) || 40;

      openConcertGadget("custom_text");
    });
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

  // Show top controls and temporary hint briefly upon opening, then auto-fade after 1500ms
  if (controls) {
    controls.classList.remove("fade-out");
    controls.style.opacity = "1";
    clearTimeout(controlsHintTimeout);
    controlsHintTimeout = setTimeout(function () {
      controls.classList.add("fade-out");
    }, 1500);
  }

  if (type === "candle") {
    startCandleFlame(stage);
  } else if (type === "bravo") {
    startBravoBanner(stage);
  } else if (type === "custom_text") {
    startCustomTextMarquee(stage, customTickerText, customTickerColor, customTickerSpeed);
  } else if (type === "glowstick") {
    startGlowstick(stage);
  } else if (type === "heart") {
    startPulsingHeart(stage);
  }
}

function closeConcertGadget() {
  if (controlsHintTimeout !== null) {
    clearTimeout(controlsHintTimeout);
    controlsHintTimeout = null;
  }

  if (candleInteractiveCleanup !== null) {
    candleInteractiveCleanup();
  }

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
    }, 1500);
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

// --- GADGET 2: GIANT "BRAVO" BANNER (LANDSCAPE) ---
function startBravoBanner(container) {
  container.innerHTML = `
    <div class="banner-wrapper w-100 h-100 d-flex flex-column justify-content-center align-items-center">
      <div class="bravo-neon-text">BRAVO !</div>
      <div class="bravo-stars d-flex gap-3 mt-3">
        <span class="star-icon">★</span>
        <span class="star-icon">★</span>
        <span class="star-icon">★</span>
        <span class="star-icon">★</span>
        <span class="star-icon">★</span>
      </div>
    </div>
  `;
}

// --- GADGET 3: CUSTOM TEXT MARQUEE TICKER (LANDSCAPE) ---
function startCustomTextMarquee(container, text, colorHex, speedLevel) {
  const cleanText = (text || "ONE MORE !").toUpperCase();
  const isShortWord = cleanText.length <= 8;

  if (isShortWord) {
    container.innerHTML = `
      <div class="banner-wrapper w-100 h-100 d-flex justify-content-center align-items-center p-3">
        <div class="giant-static-text" style="color: ${colorHex}; text-shadow: 0 0 25px ${colorHex}, 0 0 50px ${colorHex};">
          ${escapeHtml(cleanText)}
        </div>
      </div>
    `;
  } else {
    const durationSec = Math.max(5, Math.round((cleanText.length * 15) / (speedLevel || 40)));
    container.innerHTML = `
      <div class="ticker-wrapper w-100 h-100 d-flex align-items-center overflow-hidden">
        <div class="ticker-track" style="animation-duration: ${durationSec}s;">
          <span class="ticker-item" style="color: ${colorHex}; text-shadow: 0 0 20px ${colorHex};">
            ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; 
          </span>
          <span class="ticker-item" style="color: ${colorHex}; text-shadow: 0 0 20px ${colorHex};">
            ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; ${escapeHtml(cleanText)} &nbsp;&bull;&nbsp; 
          </span>
        </div>
      </div>
    `;
  }
}

// --- GADGET 4: NEON GLOWSTICK (PORTRAIT) ---
function startGlowstick(container) {
  container.innerHTML = `
    <div class="glowstick-wrapper w-100 h-100 d-flex flex-column justify-content-center align-items-center" style="--glow-color: #00e676;">
      <div class="glowstick-halo"></div>
      <div class="glowstick-tube">
        <div class="glowstick-liquid">
          <div class="glowstick-core"></div>
          <div class="glowstick-glass-shine"></div>
        </div>
      </div>
      <div class="glowstick-controls mt-4 d-flex gap-3">
        <button class="btn btn-sm rounded-circle p-3 bg-success border border-white shadow" title="Neon Green" onclick="event.stopPropagation(); setGlowstickColor('#00e676')"></button>
        <button class="btn btn-sm rounded-circle p-3 bg-info border border-white shadow" title="Electric Cyan" onclick="event.stopPropagation(); setGlowstickColor('#00d2ff')"></button>
        <button class="btn btn-sm rounded-circle p-3 bg-danger border border-white shadow" title="Magenta Pink" onclick="event.stopPropagation(); setGlowstickColor('#ff007f')"></button>
        <button class="btn btn-sm rounded-circle p-3 bg-warning border border-white shadow" title="Amber Yellow" onclick="event.stopPropagation(); setGlowstickColor('#ffeb3b')"></button>
      </div>
    </div>
  `;
}

function setGlowstickColor(colorHex) {
  const wrapper = document.querySelector(".glowstick-wrapper");
  if (wrapper) {
    wrapper.style.setProperty("--glow-color", colorHex);
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
