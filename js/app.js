// Main application bootstrap and tab management
// Pure procedural implementation

let deferredInstallPrompt = null;

// Register Service Worker for offline PWA functionality
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("./sw.js")
        .then(function (reg) {
          console.log("Service Worker registered successfully, scope:", reg.scope);
        })
        .catch(function (err) {
          console.warn("Service Worker registration failed:", err);
        });
    });
  }
}

// Handle PWA install prompt (Add to Home Screen banner)
function setupInstallPrompt() {
  const installBtn = document.getElementById("pwaInstallBtn");

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) {
      installBtn.classList.remove("d-none");
    }
  });

  if (installBtn) {
    installBtn.addEventListener("click", async function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        console.log("User accepted PWA installation");
      }
      deferredInstallPrompt = null;
      installBtn.classList.add("d-none");
    });
  }

  window.addEventListener("appinstalled", function () {
    console.log("PWA installed successfully");
    if (installBtn) {
      installBtn.classList.add("d-none");
    }
  });
}

// Setup tab listeners
function setupTabEvents() {
  const tabLinks = document.querySelectorAll('button[data-bs-toggle="pill"]');
  tabLinks.forEach(function (tabEl) {
    tabEl.addEventListener("shown.bs.tab", function (event) {
      const targetId = event.target.getAttribute("data-bs-target");

      // Stop tuner microphone if user switches away to save battery
      if (targetId !== "#pills-tuner" && typeof isTunerActive !== "undefined" && isTunerActive) {
        stopTuner();
      }

      // Update global metronome quick stop bar when switching tabs
      if (typeof updateGlobalMetronomeBar === "function") {
        updateGlobalMetronomeBar();
      }
    });
  });
}

// Global initialization when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initMetronome();
  initSetlist();
  initTuner();
  setupTabEvents();
  setupInstallPrompt();
  registerServiceWorker();
});
