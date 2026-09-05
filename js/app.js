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
          // Check for updates on every load
          reg.update();

          reg.addEventListener("updatefound", function () {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", function () {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("New version detected, auto-reloading...");
                  window.location.reload();
                }
              });
            }
          });
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

      // Close concert gadget if user switches tab
      if (typeof closeConcertGadget === "function") {
        closeConcertGadget();
      }

      // Update global metronome quick stop bar when switching tabs
      if (typeof updateGlobalMetronomeBar === "function") {
        updateGlobalMetronomeBar();
      }
    });
  });
}

// Force reload and purge all cache to fetch the latest version from network
function setupForceReload() {
  const reloadBtn = document.getElementById("forceReloadBtn");
  if (!reloadBtn) return;

  reloadBtn.addEventListener("click", async function () {
    reloadBtn.disabled = true;
    reloadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Updating...';

    try {
      // 1. Unregister all service workers so network requests bypass cache
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }

      // 2. Delete all caches in CacheStorage
      if ("caches" in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
    } catch (err) {
      console.warn("Error clearing cache:", err);
    }

    // 3. Reload with a timestamp query param to completely bypass browser HTTP cache
    const cleanUrl = window.location.origin + window.location.pathname + "?t=" + Date.now();
    window.location.replace(cleanUrl);
  });
}

// Global initialization when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initMetronome();
  initSetlist();
  initTuner();
  initAutoBpm();
  if (typeof initGadgets === "function") {
    initGadgets();
  }
  setupTabEvents();
  setupInstallPrompt();
  setupForceReload();
  registerServiceWorker();
});
