// Setlist and Presets Manager
// Procedural functional implementation using localStorage

const STORAGE_KEY = "metronome_setlist_v1";

let playlist = [];
let currentSongIndex = 0;

// Load playlist from localStorage or initialize with defaults
function loadSetlist() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      playlist = JSON.parse(saved);
    }
  } catch (err) {
    console.error("Failed to load setlist from storage:", err);
    playlist = [];
  }

  // Provide initial preset songs if empty
  if (!playlist || playlist.length === 0) {
    playlist = [
      { id: "song_1", title: "Warmup Groove", bpm: 100, timeSignature: 4, notes: "Steady 4/4 warmup" },
      { id: "song_2", title: "Fast Rocker", bpm: 145, timeSignature: 4, notes: "Energetic intro" },
      { id: "song_3", title: "Acoustic Ballad", bpm: 72, timeSignature: 3, notes: "Waltz rhythm 3/4" },
      { id: "song_4", title: "Upbeat Finale", bpm: 160, timeSignature: 4, notes: "Final sprint" }
    ];
    saveSetlist();
  }
}

function saveSetlist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlist));
  } catch (err) {
    console.error("Failed to save setlist to storage:", err);
  }
}

// Select a song and apply its tempo and signature to the metronome
function selectSong(index) {
  if (index < 0 || index >= playlist.length) {
    return;
  }
  currentSongIndex = index;
  const song = playlist[index];

  // Apply to metronome
  updateBpm(song.bpm);

  const sigSelect = document.getElementById("timeSignatureSelect");
  if (sigSelect) {
    sigSelect.value = song.timeSignature || 4;
    sigSelect.dispatchEvent(new Event("change"));
  }

  updateActiveSongBadge();
  renderSetlist();
}

function nextSong() {
  if (playlist.length === 0) return;
  const nextIdx = (currentSongIndex + 1) % playlist.length;
  selectSong(nextIdx);
}

function prevSong() {
  if (playlist.length === 0) return;
  const prevIdx = (currentSongIndex - 1 + playlist.length) % playlist.length;
  selectSong(prevIdx);
}

// Update the quick song bar visible above the metronome
function updateActiveSongBadge() {
  const badge = document.getElementById("activeSongBadge");
  const subText = document.getElementById("activeSongSubText");
  if (playlist.length > 0 && playlist[currentSongIndex]) {
    const song = playlist[currentSongIndex];
    if (badge) badge.textContent = (currentSongIndex + 1) + ". " + song.title;
    if (subText) subText.textContent = song.bpm + " BPM (" + (song.timeSignature || 4) + "/4)";
  } else {
    if (badge) badge.textContent = "No song selected";
    if (subText) subText.textContent = "-";
  }
}

// Render the full setlist management list
function renderSetlist() {
  const container = document.getElementById("setlistItemsContainer");
  if (!container) return;

  container.innerHTML = "";

  if (playlist.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">No songs in playlist. Add one below!</div>';
    return;
  }

  playlist.forEach(function (song, idx) {
    const isCurrent = (idx === currentSongIndex);
    const item = document.createElement("div");
    item.className = "setlist-item" + (isCurrent ? " current-song" : "");

    item.innerHTML = `
      <div class="d-flex align-items-center flex-grow-1 me-2" role="button" onclick="selectSong(${idx})">
        <span class="badge ${isCurrent ? 'bg-success text-dark' : 'bg-secondary'} me-3 fs-6">${idx + 1}</span>
        <div>
          <div class="fw-bold ${isCurrent ? 'text-success' : 'text-white'}">${escapeHtml(song.title)}</div>
          <small class="text-muted">${song.bpm} BPM &bull; ${song.timeSignature || 4}/4 ${song.notes ? '&bull; ' + escapeHtml(song.notes) : ''}</small>
        </div>
      </div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-secondary" title="Move Up" onclick="moveSong(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>
          <i class="bi bi-chevron-up"></i>
        </button>
        <button class="btn btn-outline-secondary" title="Move Down" onclick="moveSong(${idx}, 1)" ${idx === playlist.length - 1 ? 'disabled' : ''}>
          <i class="bi bi-chevron-down"></i>
        </button>
        <button class="btn btn-outline-danger" title="Delete" onclick="deleteSong(${idx})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

    container.appendChild(item);
  });
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
  const newSong = {
    id: "song_" + Date.now(),
    title: title.trim() || "Untitled Song",
    bpm: parseInt(songBpm, 10) || 120,
    timeSignature: parseInt(timeSig, 10) || 4,
    notes: (notes || "").trim()
  };

  playlist.push(newSong);
  saveSetlist();
  renderSetlist();
}

function deleteSong(index) {
  if (index < 0 || index >= playlist.length) return;
  playlist.splice(index, 1);
  if (currentSongIndex >= playlist.length) {
    currentSongIndex = Math.max(0, playlist.length - 1);
  }
  saveSetlist();
  updateActiveSongBadge();
  renderSetlist();
}

function moveSong(index, direction) {
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

  saveSetlist();
  updateActiveSongBadge();
  renderSetlist();
}

function initSetlist() {
  loadSetlist();
  updateActiveSongBadge();
  renderSetlist();

  // Quick navigation buttons on metronome view
  const prevBtn = document.getElementById("quickPrevSongBtn");
  const nextBtn = document.getElementById("quickNextSongBtn");
  if (prevBtn) prevBtn.addEventListener("click", prevSong);
  if (nextBtn) nextBtn.addEventListener("click", nextSong);

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

  // Pre-fill modal BPM when opening
  const modalEl = document.getElementById("addSongModal");
  if (modalEl) {
    modalEl.addEventListener("show.bs.modal", function () {
      const bpmInput = document.getElementById("newSongBpm");
      if (bpmInput) bpmInput.value = bpm;
    });
  }
}
