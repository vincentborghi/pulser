// Main application bootstrap and tab management
// Pure procedural implementation

const APP_RELEASE_TIMESTAMP = "2026-09-05 17:25:00 CEST";
let deferredInstallPrompt = null;

// Register Service Worker for offline PWA functionality
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("./sw.js?v=20260905_21", { updateViaCache: "none" })
        .then(function (reg) {
          console.log("Service Worker registered successfully, scope:", reg.scope);
          // Check for updates on every load
          reg.update().catch(function () {});

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
let isHistoryNavigating = false;

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
      if (typeof closeConcertGadget === "function" && typeof activeGadgetType !== "undefined" && activeGadgetType !== null) {
        closeConcertGadget(true);
      }

      // Update global metronome quick stop bar when switching tabs
      if (typeof updateGlobalMetronomeBar === "function") {
        updateGlobalMetronomeBar();
      }

      // Manage history state on manual UI tab switch
      if (!isHistoryNavigating) {
        try {
          if (targetId === "#pills-metronome") {
            history.replaceState({ pulser: "metro" }, "");
          } else if (history.state && history.state.pulser === "tab") {
            history.replaceState({ pulser: "tab", tab: targetId }, "");
          } else {
            history.pushState({ pulser: "tab", tab: targetId }, "");
          }
        } catch (err) {
          console.warn("History push warning:", err);
        }
      }
    });
  });
}

// Navigation History & Browser Back Button Management
function initNavigationHistory() {
  try {
    if (!history.state || !history.state.pulser) {
      history.replaceState({ pulser: "root" }, "");
      history.pushState({ pulser: "metro" }, "");
    }
  } catch (err) {
    console.warn("History API init warning:", err);
  }

  // Handle browser Back / Forward events
  window.addEventListener("popstate", function (e) {
    handlePopState(e);
  });

  // Handle Bootstrap modal show/hide with history
  const modals = document.querySelectorAll(".modal");
  modals.forEach(function (modalEl) {
    modalEl.addEventListener("show.bs.modal", function () {
      if (!isHistoryNavigating) {
        try {
          history.pushState({ pulser: "modal", modalId: modalEl.id }, "");
        } catch (e) {}
      }
    });

    modalEl.addEventListener("hidden.bs.modal", function () {
      if (!isHistoryNavigating) {
        try {
          if (history.state && history.state.pulser === "modal") {
            history.back();
          }
        } catch (e) {}
      }
    });
  });
}

function handlePopState(e) {
  // 1. If a concert gadget overlay is currently open, close it and return to Gadgets page
  if (typeof activeGadgetType !== "undefined" && activeGadgetType !== null) {
    if (typeof closeConcertGadget === "function") {
      closeConcertGadget(true);
    }
    return;
  }

  // 2. If any open modal is shown, close it
  const openModal = document.querySelector(".modal.show");
  if (openModal) {
    isHistoryNavigating = true;
    const modalInstance = bootstrap.Modal.getInstance(openModal);
    if (modalInstance) {
      modalInstance.hide();
    }
    isHistoryNavigating = false;
    return;
  }

  // 3. If user is on a non-metronome tab (setlist, tuner, gadgets), return to Metronome tab
  const activeTabEl = document.querySelector('.nav-link.active[data-bs-toggle="pill"]');
  const activeTabTarget = activeTabEl ? activeTabEl.getAttribute("data-bs-target") : null;

  if (activeTabTarget && activeTabTarget !== "#pills-metronome") {
    const metroTabBtn = document.getElementById("pills-metronome-tab");
    if (metroTabBtn) {
      isHistoryNavigating = true;
      const tabInstance = bootstrap.Tab.getOrCreateInstance(metroTabBtn);
      tabInstance.show();
      isHistoryNavigating = false;

      // Update state to metro so that subsequent Back asks for exit confirmation
      try {
        history.replaceState({ pulser: "metro" }, "");
      } catch (err) {}
    }
    return;
  }

  // 4. If user is already on the Metronome tab, ask for confirmation before exiting
  const exitConfirmed = window.confirm("Do you want to exit Pulser?");
  if (exitConfirmed) {
    // User confirmed exit: allow the browser to leave
    history.back();
  } else {
    // User canceled exit: re-push metro state so the user remains in the app
    try {
      history.pushState({ pulser: "metro" }, "");
    } catch (err) {}
  }
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

      // 3. Reset preset storage keys to guarantee freshest default presets on reload
      try {
        localStorage.removeItem("metronome_quick_bpm_presets_v1");
        localStorage.removeItem("metronome_quick_bpm_presets_v2");
        localStorage.removeItem("metronome_quick_bpm_presets_v3");
        localStorage.removeItem("metronome_quick_bpm_presets_v4");
        localStorage.removeItem("metronome_quick_bpm_presets_v5");
      } catch (e) {}
    } catch (err) {
      console.warn("Error clearing cache:", err);
    }

    // 4. Reload with a timestamp query param to completely bypass browser HTTP cache
    const cleanUrl = window.location.origin + window.location.pathname + "?force_reload=" + Date.now();
    window.location.replace(cleanUrl);
  });
}

// Populate About modal release timestamp
function setupAboutModal() {
  const tsBadge = document.getElementById("appReleaseTimestamp");
  if (tsBadge) {
    tsBadge.textContent = APP_RELEASE_TIMESTAMP;
  }
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
  initNavigationHistory();
  setupInstallPrompt();
  setupForceReload();
  setupAboutModal();
  registerServiceWorker();
});
