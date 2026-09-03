// Concert Gadgets Module for Audience / Spectator Stage Beacons
// Pure procedural implementation using Web APIs, Canvas, and CSS animations

let activeGadgetType = null;
let gadgetAnimFrameId = null;
let gadgetWakeLockSentinel = null;
let isGadgetRotated90 = false;
let customTickerText = "BRAVO !";
let customTickerColor = "#ffcc00"; // Golden amber
let customTickerSpeed = 40; // Pixels per frame

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
        customTickerText = "BRAVO !";
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

  // Fullscreen overlay controls
  const overlay = document.getElementById("concertGadgetOverlay");
  const closeBtn = document.getElementById("closeGadgetOverlayBtn");
  const rotateBtn = document.getElementById("rotateGadgetOverlayBtn");

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

function openConcertGadget(type) {
  const overlay = document.getElementById("concertGadgetOverlay");
  const stage = document.getElementById("gadgetStageContainer");
  const controls = document.getElementById("gadgetOverlayControls");
  if (!overlay || !stage) return;

  activeGadgetType = type;
  stage.innerHTML = "";
  overlay.classList.remove("d-none");

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

// --- GADGET 2: GRAND "BRAVO" ANIMÉ (PAYSAGE) ---
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

// --- GADGET 3: CHENILLARD / MARQUEE TEXTE PERSONNALISÉ ---
function startCustomTextMarquee(container, text, colorHex, speedLevel) {
  const cleanText = (text || "BRAVO !").toUpperCase();
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

// --- GADGET 4: BÂTON LUMINEUX FLUO (GLOWSTICK) ---
function startGlowstick(container) {
  container.innerHTML = `
    <div class="glowstick-wrapper w-100 h-100 d-flex flex-column justify-content-center align-items-center">
      <div class="glowstick-tube">
        <div class="glowstick-liquid"></div>
      </div>
      <div class="glowstick-controls mt-4 d-flex gap-2">
        <button class="btn btn-sm rounded-circle p-3 bg-success border border-white" onclick="event.stopPropagation(); setGlowstickColor('#00e676')"></button>
        <button class="btn btn-sm rounded-circle p-3 bg-info border border-white" onclick="event.stopPropagation(); setGlowstickColor('#00d2ff')"></button>
        <button class="btn btn-sm rounded-circle p-3 bg-danger border border-white" onclick="event.stopPropagation(); setGlowstickColor('#ff007f')"></button>
        <button class="btn btn-sm rounded-circle p-3 bg-warning border border-white" onclick="event.stopPropagation(); setGlowstickColor('#ffeb3b')"></button>
      </div>
    </div>
  `;
}

function setGlowstickColor(colorHex) {
  const liquid = document.querySelector(".glowstick-liquid");
  const tube = document.querySelector(".glowstick-tube");
  if (liquid && tube) {
    liquid.style.backgroundColor = colorHex;
    tube.style.boxShadow = "0 0 50px " + colorHex + ", 0 0 100px " + colorHex;
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
