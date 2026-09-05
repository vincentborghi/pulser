// Setlist and Multi-Playlist Manager
// Procedural functional implementation using localStorage

const SETLISTS_STORAGE_KEY = "metronome_setlists_collection_v2";
const ACTIVE_SETLIST_ID_KEY = "metronome_active_setlist_id_v2";
const LEGACY_STORAGE_KEY = "metronome_setlist_v1";

let setlists = [];
let activeSetlistId = null;
let currentSongIndex = -1; // -1 represents Free Mode (neutral, no song selected)
let setlistModalMode = "new"; // "new" or "rename"

const defaultSongs = [
  { id: "song_1", title: "Warmup Groove", bpm: 100, timeSignature: 4, notes: "Steady 4/4 warmup" },
  { id: "song_2", title: "Fast Rocker", bpm: 145, timeSignature: 4, notes: "Energetic intro" },
  { id: "song_3", title: "Acoustic Ballad", bpm: 72, timeSignature: 3, notes: "Waltz rhythm 3/4" },
  { id: "song_4", title: "Upbeat Finale", bpm: 160, timeSignature: 4, notes: "Final sprint" }
];

// Fan di Stelle default setlist
const fanDiStelleSongs = [
  { id: "fds_1",  title: "Goka Dunya",       bpm: null, timeSignature: 4, notes: "" },
  { id: "fds_2",  title: "Les mains d'or",   bpm: null, timeSignature: 4, notes: "" },
  { id: "fds_3",  title: "Ce qui est dit",   bpm: 110,  timeSignature: 4, notes: "" },
  { id: "fds_4",  title: "Con toda palabra", bpm: 110,  timeSignature: 4, notes: "" },
  { id: "fds_5",  title: "Le baiser",        bpm: 140,  timeSignature: 4, notes: "" },
  { id: "fds_6",  title: "Amari",            bpm: null, timeSignature: 4, notes: "" },
  { id: "fds_7",  title: "L'aviateur",       bpm: null, timeSignature: 4, notes: "" },
  { id: "fds_8",  title: "Fragile",          bpm: 84,   timeSignature: 4, notes: "" },
  { id: "fds_9",  title: "Bidonville",       bpm: 90,   timeSignature: 4, notes: "" },
  { id: "fds_10", title: "La corrida",       bpm: null, timeSignature: 4, notes: "" },
  { id: "fds_11", title: "Tete en l'air",    bpm: 125,  timeSignature: 4, notes: "" },
  { id: "fds_12", title: "Melodie du vent",  bpm: 88,   timeSignature: 4, notes: "" },
  { id: "fds_13", title: "Que sera",         bpm: null, timeSignature: 4, notes: "" }
];

// Load multi-setlist collection from localStorage with migration from legacy format
function loadSetlists() {
  try {
    const saved = localStorage.getItem(SETLISTS_STORAGE_KEY);
    if (saved) {
      setlists = JSON.parse(saved);
    }
  } catch (err) {
    console.error("Failed to parse setlists collection:", err);
    setlists = [];
  }

  // If no setlists stored yet, initialize defaults with Main Setlist and Fan di Stelle
  if (!Array.isArray(setlists) || setlists.length === 0) {
    let legacySongs = [];
    try {
      const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacySaved) {
        legacySongs = JSON.parse(legacySaved);
      }
    } catch (e) {}

    setlists = [
      {
        id: "setlist_default",
        name: "Main Setlist",
        songs: Array.isArray(legacySongs) && legacySongs.length > 0 ? legacySongs : defaultSongs
      },
      {
        id: "setlist_fan_di_stelle",
        name: "Fan di Stelle",
        songs: JSON.parse(JSON.stringify(fanDiStelleSongs))
      }
    ];
    saveSetlists();
  } else {
    // Ensure Fan di Stelle is present even if user already had previous setlists
    const hasFanDiStelle = setlists.some(function (s) {
      return s.id === "setlist_fan_di_stelle" || s.name === "Fan di Stelle";
    });
    if (!hasFanDiStelle) {
      setlists.push({
        id: "setlist_fan_di_stelle",
        name: "Fan di Stelle",
        songs: JSON.parse(JSON.stringify(fanDiStelleSongs))
      });
      saveSetlists();
    }
  }

  // Load active setlist ID
  const savedActiveId = localStorage.getItem(ACTIVE_SETLIST_ID_KEY);
  if (savedActiveId && setlists.some(function (s) { return s.id === savedActiveId; })) {
    activeSetlistId = savedActiveId;
  } else {
    activeSetlistId = setlists[0].id;
    saveActiveSetlistId();
  }
}

function saveSetlists() {
  try {
    localStorage.setItem(SETLISTS_STORAGE_KEY, JSON.stringify(setlists));
    saveActiveSetlistId();
  } catch (err) {
    console.error("Failed to save setlists collection:", err);
  }
}

function saveActiveSetlistId() {
  try {
    if (activeSetlistId) {
      localStorage.setItem(ACTIVE_SETLIST_ID_KEY, activeSetlistId);
    }
  } catch (e) {}
}

function getActiveSetlist() {
  for (let i = 0; i < setlists.length; i++) {
    if (setlists[i].id === activeSetlistId) {
      return setlists[i];
    }
  }
  return setlists[0] || null;
}

function getSetlists() {
  return setlists;
}

function getActivePlaylist() {
  const active = getActiveSetlist();
  return active ? active.songs : [];
}

// Create a new named setlist
function createSetlist(name) {
  const cleanName = (name || "").trim() || "New Setlist";
  const newSetlist = {
    id: "setlist_" + Date.now(),
    name: cleanName,
    songs: []
  };
  setlists.push(newSetlist);
  activeSetlistId = newSetlist.id;
  currentSongIndex = -1; // Reset to free mode
  saveSetlists();
  renderSetlistUI();
}

// Rename current setlist
function renameActiveSetlist(newName) {
  const active = getActiveSetlist();
  if (active) {
    active.name = (newName || "").trim() || active.name;
    saveSetlists();
    renderSetlistUI();
  }
}

// Delete current setlist
function deleteActiveSetlist() {
  if (setlists.length <= 1) {
    alert("You must have at least one active setlist.");
    return;
  }

  const active = getActiveSetlist();
  if (!active) return;

  const confirmMsg = "Are you sure you want to delete setlist \"" + active.name + "\" and its " + active.songs.length + " song(s)?";
  if (!confirm(confirmMsg)) return;

  setlists = setlists.filter(function (s) {
    return s.id !== active.id;
  });

  activeSetlistId = setlists[0].id;
  currentSongIndex = -1; // Reset to free mode
  saveSetlists();
  renderSetlistUI();
}

// Switch to a different setlist
function switchActiveSetlist(newId) {
  if (newId === activeSetlistId) return;
  const found = setlists.some(function (s) { return s.id === newId; });
  if (found) {
    activeSetlistId = newId;
    currentSongIndex = -1; // Reset to free mode when switching sets
    saveActiveSetlistId();
    renderSetlistUI();
  }
}

// Select a song and apply its tempo and signature to the metronome
function selectSong(index) {
  const playlist = getActivePlaylist();
  if (index < 0 || index >= playlist.length) {
    return;
  }
  currentSongIndex = index;
  const song = playlist[index];
  const hasValidBpm = song.bpm && parseInt(song.bpm, 10) > 0;

  // Apply to metronome if song has a valid BPM, otherwise show "-"
  if (hasValidBpm) {
    updateBpm(parseInt(song.bpm, 10));
  } else {
    if (typeof setBpmUnspecified === "function") {
      setBpmUnspecified();
    }
    // Stop metronome if it was playing when switching to a song without BPM
    if (typeof isEnginePlaying === "function" && isEnginePlaying()) {
      const playBtn = document.getElementById("playButton");
      if (playBtn) {
        playBtn.click();
      }
    }
  }

  const sigSelect = document.getElementById("timeSignatureSelect");
  if (sigSelect) {
    sigSelect.value = song.timeSignature || 4;
    sigSelect.dispatchEvent(new Event("change"));
  }

  updateActiveSongBadge();
  renderSetlist();
}

// Select a song, start the metronome (only if BPM is specified), and return to Metronome tab directly
function playSongAndGoToMetronome(index, evt) {
  if (evt) {
    evt.stopPropagation();
  }
  const playlist = getActivePlaylist();
  if (index < 0 || index >= playlist.length) {
    return;
  }
  const song = playlist[index];
  const hasValidBpm = song.bpm && parseInt(song.bpm, 10) > 0;

  selectSong(index);

  // If song has a valid BPM, start metronome if not already playing
  if (hasValidBpm) {
    const isPlayingNow = (typeof isEnginePlaying === "function") ? isEnginePlaying() : false;
    if (!isPlayingNow) {
      const playBtn = document.getElementById("playButton");
      if (playBtn) {
        playBtn.click();
      }
    }
  }

  // Switch to Metronome tab
  const metronomeTab = document.getElementById("pills-metronome-tab");
  if (metronomeTab) {
    metronomeTab.click();
  }
}

// Clear active song and return to neutral free metronome mode
function clearActiveSong() {
  currentSongIndex = -1;
  updateActiveSongBadge();
  renderSetlist();
}

function nextSong() {
  const playlist = getActivePlaylist();
  if (playlist.length === 0) return;
  if (currentSongIndex === -1) {
    selectSong(0);
  } else if (currentSongIndex === playlist.length - 1) {
    clearActiveSong();
  } else {
    selectSong(currentSongIndex + 1);
  }
}

function prevSong() {
  const playlist = getActivePlaylist();
  if (playlist.length === 0) return;
  if (currentSongIndex === -1) {
    selectSong(playlist.length - 1);
  } else if (currentSongIndex === 0) {
    clearActiveSong();
  } else {
    selectSong(currentSongIndex - 1);
  }
}

// Update the quick song bar visible above the metronome
function updateActiveSongBadge() {
  const badge = document.getElementById("activeSongBadge");
  const subText = document.getElementById("activeSongSubText");
  const clearBtn = document.getElementById("clearActiveSongBtn");
  const centerZone = document.getElementById("activeSongCenterZone");
  const activeSetlist = getActiveSetlist();
  const setlistName = activeSetlist ? activeSetlist.name : "Setlist";
  const playlist = getActivePlaylist();

  if (currentSongIndex >= 0 && playlist.length > 0 && playlist[currentSongIndex]) {
    const song = playlist[currentSongIndex];
    if (badge) badge.textContent = (currentSongIndex + 1) + ". " + song.title;
    const bpmStr = (song.bpm && parseInt(song.bpm, 10) > 0) ? (song.bpm + " BPM") : "BPM: -";
    if (subText) subText.textContent = setlistName + " - " + bpmStr + " (" + (song.timeSignature || 4) + "/4)";
    if (clearBtn) clearBtn.classList.remove("d-none");
    if (centerZone) {
      centerZone.title = "Tap to open Setlist";
    }
  } else {
    if (badge) badge.textContent = "Free Mode";
    if (subText) subText.innerHTML = setlistName + " &bull; <span class=\"text-info fw-bold\">Tap to choose song &rsaquo;</span>";
    if (clearBtn) clearBtn.classList.add("d-none");
    if (centerZone) {
      centerZone.title = "Tap to choose a song from Setlist";
    }
  }
}

// Render the active setlist dropdown
function renderSetlistSelect() {
  const select = document.getElementById("setlistSelect");
  if (!select) return;

  select.innerHTML = "";
  setlists.forEach(function (s) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name + " (" + s.songs.length + " song" + (s.songs.length > 1 ? "s" : "") + ")";
    if (s.id === activeSetlistId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  const active = getActiveSetlist();
  const headerTitle = document.getElementById("currentSetlistHeaderTitle");
  const headerCount = document.getElementById("currentSetlistHeaderCount");
  if (headerTitle && active) {
    headerTitle.textContent = active.name;
  }
  if (headerCount && active) {
    headerCount.textContent = active.songs.length + " song" + (active.songs.length > 1 ? "s" : "") + " - Tap to load into metronome";
  }
}

// Render the full setlist management list
function renderSetlist() {
  const container = document.getElementById("setlistItemsContainer");
  if (!container) return;

  const playlist = getActivePlaylist();
  container.innerHTML = "";

  if (playlist.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-music-note-list fs-1 d-block mb-2 text-secondary"></i>No songs in this setlist yet.<br><small class="text-white-50">Click "Add Song" above to add your first tune!</small></div>';
    return;
  }

  // If a song is currently loaded, display a button to detach / return to Free Mode
  if (currentSongIndex >= 0 && playlist[currentSongIndex]) {
    const freeModeBanner = document.createElement("div");
    freeModeBanner.className = "d-flex justify-content-between align-items-center mb-3 p-2 bg-dark rounded border border-warning-subtle shadow-sm";
    freeModeBanner.innerHTML = `
      <div class="small text-truncate me-2">
        <span class="text-muted">Active:</span> <strong class="text-white">${escapeHtml(playlist[currentSongIndex].title)}</strong>
      </div>
      <button class="btn btn-sm btn-outline-warning fw-bold" onclick="clearActiveSong()">
        <i class="bi bi-box-arrow-left me-1"></i>Free Mode
      </button>
    `;
    container.appendChild(freeModeBanner);
  }

  playlist.forEach(function (song, idx) {
    const isCurrent = (idx === currentSongIndex);
    const item = document.createElement("div");
    item.className = "setlist-item" + (isCurrent ? " current-song" : "");
    item.setAttribute("role", "button");
    item.onclick = function () {
      selectSong(idx);
    };

    const bpmBadgeHtml = (song.bpm && parseInt(song.bpm, 10) > 0)
      ? '<strong class="text-white">' + song.bpm + '</strong> BPM'
      : '<span class="badge bg-secondary text-white-50 border border-secondary">BPM: -</span>';

    item.innerHTML = `
      <div class="d-flex align-items-center justify-content-between w-100 mb-1">
        <div class="d-flex align-items-center flex-grow-1 overflow-hidden me-2">
          <span class="badge ${isCurrent ? 'bg-success text-dark fw-bold' : 'bg-secondary'} me-2 fs-6 flex-shrink-0">${idx + 1}</span>
          <div class="fw-bold ${isCurrent ? 'text-success' : 'text-white'} text-truncate" style="font-size: 1.12rem; line-height: 1.25;">
            ${escapeHtml(song.title)}
          </div>
        </div>
        <button class="btn btn-success btn-sm fw-bold px-3 py-1 flex-shrink-0 shadow-sm d-flex align-items-center text-white" onclick="playSongAndGoToMetronome(${idx}, event)" title="Play in metronome">
          <i class="bi bi-play-fill fs-5 me-1 text-white"></i>Play
        </button>
      </div>
      <div class="d-flex justify-content-between align-items-center w-100 mt-1">
        <div class="small text-white-50 text-truncate me-2">
          ${bpmBadgeHtml} &bull; ${song.timeSignature || 4}/4 ${song.notes ? '&bull; ' + escapeHtml(song.notes) : ''}
        </div>
        <div class="btn-group btn-group-sm flex-shrink-0" onclick="event.stopPropagation()">
          <button class="btn btn-outline-info px-2" title="Edit Song (BPM, Signature, Title)" onclick="openEditSongModal(${idx})">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="btn btn-outline-light px-2" title="Move Up" onclick="moveSong(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>
            <i class="bi bi-chevron-up"></i>
          </button>
          <button class="btn btn-outline-light px-2" title="Move Down" onclick="moveSong(${idx}, 1)" ${idx === playlist.length - 1 ? 'disabled' : ''}>
            <i class="bi bi-chevron-down"></i>
          </button>
          <button class="btn btn-outline-danger px-2" title="Delete Song" onclick="deleteSong(${idx})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;

    container.appendChild(item);
  });
}

function renderSetlistUI() {
  renderSetlistSelect();
  renderSetlist();
  updateActiveSongBadge();
  if (typeof updateGlobalMetronomeBar === "function") {
    updateGlobalMetronomeBar();
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m];
  });
}

function addSong(title, songBpm, timeSig, notes) {
  const active = getActiveSetlist();
  if (!active) return;

  let parsedBpm = parseInt(songBpm, 10);
  if (isNaN(parsedBpm) || parsedBpm <= 0) {
    parsedBpm = null;
  }

  const newSong = {
    id: "song_" + Date.now(),
    title: title.trim() || "Untitled Song",
    bpm: parsedBpm,
    timeSignature: parseInt(timeSig, 10) || 4,
    notes: (notes || "").trim()
  };

  active.songs.push(newSong);
  saveSetlists();
  renderSetlistUI();
}

let editingSongIndex = -1;

function openEditSongModal(index) {
  const playlist = getActivePlaylist();
  if (index < 0 || index >= playlist.length) return;

  editingSongIndex = index;
  const song = playlist[index];

  const titleInput = document.getElementById("editSongTitle");
  const bpmInput = document.getElementById("editSongBpm");
  const sigInput = document.getElementById("editSongSig");
  const notesInput = document.getElementById("editSongNotes");
  const indexInput = document.getElementById("editSongIndex");

  if (titleInput) titleInput.value = song.title;
  if (bpmInput) bpmInput.value = (song.bpm && song.bpm > 0) ? song.bpm : "";
  if (sigInput) sigInput.value = song.timeSignature || 4;
  if (notesInput) notesInput.value = song.notes || "";
  if (indexInput) indexInput.value = index;

  const modalEl = document.getElementById("editSongModal");
  if (modalEl && window.bootstrap && window.bootstrap.Modal) {
    const modalInstance = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }
}

function updateSong(index, title, songBpm, timeSig, notes) {
  const playlist = getActivePlaylist();
  if (index < 0 || index >= playlist.length) return;

  let parsedBpm = parseInt(songBpm, 10);
  if (isNaN(parsedBpm) || parsedBpm <= 0) {
    parsedBpm = null;
  }

  playlist[index].title = (title || "").trim() || playlist[index].title;
  playlist[index].bpm = parsedBpm;
  playlist[index].timeSignature = parseInt(timeSig, 10) || 4;
  playlist[index].notes = (notes || "").trim();

  // If this song is currently active in the metronome, update metronome live
  if (currentSongIndex === index) {
    if (parsedBpm && parsedBpm > 0) {
      updateBpm(parsedBpm);
    }
    const sigSelect = document.getElementById("timeSignatureSelect");
    if (sigSelect) {
      sigSelect.value = playlist[index].timeSignature;
      sigSelect.dispatchEvent(new Event("change"));
    }
    updateActiveSongBadge();
  }

  saveSetlists();
  renderSetlistUI();
}

function deleteSong(index) {
  const playlist = getActivePlaylist();
  if (index < 0 || index >= playlist.length) return;
  playlist.splice(index, 1);
  if (currentSongIndex === index) {
    currentSongIndex = -1;
  } else if (currentSongIndex > index) {
    currentSongIndex--;
  }
  saveSetlists();
  renderSetlistUI();
}

function moveSong(index, direction) {
  const playlist = getActivePlaylist();
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= playlist.length) return;

  const temp = playlist[index];
  playlist[index] = playlist[targetIndex];
  playlist[targetIndex] = temp;

  if (currentSongIndex === index) {
    currentSongIndex = targetIndex;
  } else if (currentSongIndex === targetIndex) {
    currentSongIndex = index;
  }

  saveSetlists();
  renderSetlistUI();
}

function initSetlist() {
  loadSetlists();
  renderSetlistUI();

  // Setlist selector dropdown
  const setlistSelect = document.getElementById("setlistSelect");
  if (setlistSelect) {
    setlistSelect.addEventListener("change", function () {
      switchActiveSetlist(this.value);
    });
  }

  // Modal setup for New vs Rename
  const setlistModalEl = document.getElementById("setlistModal");
  const newSetlistBtn = document.getElementById("newSetlistBtn");
  const renameSetlistBtn = document.getElementById("renameSetlistBtn");
  const setlistModalLabel = document.getElementById("setlistModalLabel");
  const setlistNameInput = document.getElementById("setlistNameInput");

  const saveSetlistBtn = document.getElementById("saveSetlistBtn");

  function configureSetlistModal(mode) {
    setlistModalMode = mode;
    if (mode === "rename") {
      if (setlistModalLabel) setlistModalLabel.textContent = "Rename Setlist";
      if (saveSetlistBtn) saveSetlistBtn.textContent = "Rename Setlist";
      const active = getActiveSetlist();
      if (setlistNameInput && active) {
        setlistNameInput.value = active.name;
      }
    } else {
      if (setlistModalLabel) setlistModalLabel.textContent = "New Setlist";
      if (saveSetlistBtn) saveSetlistBtn.textContent = "Create Setlist";
      if (setlistNameInput) {
        setlistNameInput.value = "";
        setlistNameInput.placeholder = "e.g. Rock Band, Acoustic Gig, Jazz Trio";
      }
    }
  }

  if (newSetlistBtn) {
    newSetlistBtn.addEventListener("click", function () {
      configureSetlistModal("new");
    });
  }

  if (renameSetlistBtn) {
    renameSetlistBtn.addEventListener("click", function () {
      configureSetlistModal("rename");
    });
  }

  if (setlistModalEl) {
    setlistModalEl.addEventListener("show.bs.modal", function (e) {
      const btn = e.relatedTarget;
      if (btn && btn.getAttribute("data-action") === "rename") {
        configureSetlistModal("rename");
      } else if (btn && btn.getAttribute("data-action") === "new") {
        configureSetlistModal("new");
      }
    });
  }

  // Setlist form submission (Create or Rename)
  const setlistForm = document.getElementById("setlistForm");
  if (setlistForm) {
    setlistForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const val = setlistNameInput ? setlistNameInput.value.trim() : "";
      if (!val) return;

      if (setlistModalMode === "rename") {
        renameActiveSetlist(val);
      } else {
        createSetlist(val);
      }

      // Close modal
      if (setlistModalEl && window.bootstrap && window.bootstrap.Modal) {
        const modalInstance = window.bootstrap.Modal.getInstance(setlistModalEl);
        if (modalInstance) modalInstance.hide();
      }
    });
  }

  // Delete Setlist button
  const deleteSetlistBtn = document.getElementById("deleteSetlistBtn");
  if (deleteSetlistBtn) {
    deleteSetlistBtn.addEventListener("click", function () {
      deleteActiveSetlist();
    });
  }

  // Focus input when modal shown
  if (setlistModalEl) {
    setlistModalEl.addEventListener("shown.bs.modal", function () {
      if (setlistNameInput) {
        setlistNameInput.focus();
        setlistNameInput.select();
      }
    });
  }

  // Quick navigation buttons on metronome view
  const prevBtn = document.getElementById("quickPrevSongBtn");
  const nextBtn = document.getElementById("quickNextSongBtn");
  if (prevBtn) prevBtn.addEventListener("click", prevSong);
  if (nextBtn) nextBtn.addEventListener("click", nextSong);

  // Clear active song button on metronome view
  const clearBtn = document.getElementById("clearActiveSongBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      clearActiveSong();
    });
  }

  // Interactive song header area on metronome view (switches to Setlist tab)
  const centerZone = document.getElementById("activeSongCenterZone");
  if (centerZone) {
    centerZone.addEventListener("click", function () {
      const setlistTab = document.getElementById("pills-setlist-tab");
      if (setlistTab) {
        setlistTab.click();
      }
    });
  }

  // Add song form
  const addForm = document.getElementById("addSongForm");
  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const titleInput = document.getElementById("newSongTitle");
      const bpmInput = document.getElementById("newSongBpm");
      const sigInput = document.getElementById("newSongSig");
      const notesInput = document.getElementById("newSongNotes");

      addSong(titleInput.value, bpmInput.value, sigInput.value, notesInput.value);

      titleInput.value = "";
      notesInput.value = "";
      // Pre-fill next BPM with current metronome BPM
      bpmInput.value = bpm;

      // Close modal if using Bootstrap modal
      const modalEl = document.getElementById("addSongModal");
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
      }
    });
  }

  // Edit song form
  const editForm = document.getElementById("editSongForm");
  if (editForm) {
    editForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const titleInput = document.getElementById("editSongTitle");
      const bpmInput = document.getElementById("editSongBpm");
      const sigInput = document.getElementById("editSongSig");
      const notesInput = document.getElementById("editSongNotes");
      const indexInput = document.getElementById("editSongIndex");

      const idx = indexInput ? parseInt(indexInput.value, 10) : editingSongIndex;
      if (idx >= 0) {
        updateSong(idx, titleInput.value, bpmInput.value, sigInput.value, notesInput.value);
      }

      // Close modal if using Bootstrap modal
      const modalEl = document.getElementById("editSongModal");
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
      }
    });
  }

  // Pre-fill modal BPM when opening
  const modalEl = document.getElementById("addSongModal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", function () {
      const bpmInput = document.getElementById("newSongBpm");
      if (bpmInput) bpmInput.value = bpm;
    });
  }
}

