# Pulser

**Pulser** is a modern, high-precision web-based metronome, stage companion, and multi-tool designed for musicians, bands, and concert audiences.

Live app: [https://vincentborghi.github.io/pulser/](https://vincentborghi.github.io/pulser/)

---

## Table of Contents

1. **[Rock-Solid Metronome](#1-rock-solid-metronome)** — Sample-accurate Web Audio engine, rich sound library, flasher modes, and on-the-fly Beat 1 resync.
2. **[Multi-Setlist Manager](#2-multi-setlist-manager)** — Repertoire management, full-width mobile cards, tempo deviation tracking, and 1-click tempo reset.
3. **[Ambient Auto-BPM Detector](#3-ambient-auto-bpm-detector)** — Microphone-based beat detection using spectral flux and circular autocorrelation.
4. **[Chromatic Instrument Tuner](#4-chromatic-instrument-tuner)** — Real-time pitch detection with cent needle gauge and guitar/bass presets.
5. **[Concert Gadgets (Stage Beacons)](#5-concert-gadgets-audience-stage-beacons)** — Fullscreen audience visuals: lighter flame, scrolling LED banner, glowstick, and pulsing heart.

---

## Key Features

### 1. Rock-Solid Metronome
- **Sample-Accurate Timing**: Powered by the Web Audio API with a dual-clock lookahead scheduler (*Chris Wilson architecture*). Zero drift, zero audio jitter.
- **Dynamic Click Stabilization**: Linear soft-attack ramps and master brickwall dynamics limiter prevent transient phase clicks and smartphone speaker limiter pumping.
- **Rich Sound Library**:
  - Drum Kit (Kick + Hi-hat)
  - Synthetic Woodblock
  - Clear Electronic Beep
  - Real Human Voices (Male & Female counting: 1 to 8)
  - Latin Cowbell
  - Vintage Mechanical Clockwork Tick
  - Snare Cross-Stick Rimshot
- **Visual Display & Flasher**:
  - Full-screen or circular flash (Vivid, Subtle, Strobe, or Muted).
  - Time signatures (1/4 to 12/4) with dynamic beat dots.
  - **On-the-Fly Beat 1 Resync**: Tap the first beat dot while playing to instantly align downbeat phase without stopping.
- **Ergonomic Controls**:
  - High-contrast BPM display, responsive slider, fast delta buttons (-5, -1, +1, +5).
  - 6 customizable quick BPM presets (P1 to P6).
  - Multi-level Tap Tempo with Undo stack and 3-measure qualification history.

### 2. Multi-Setlist Manager
- Organize songs into multiple custom setlists (e.g., *Main Setlist*, *Acoustic Set*, *Live 2026*).
- Instant 1-tap loading of BPM, time signature, and notes directly into the metronome.
- **Full-Width Song Titles**: Dual-row card architecture prevents unnecessary wrapping on small smartphone screens.
- **Tempo Deviation & 1-Click Reset**: When rehearsing at altered tempos, the header highlights the deviation (e.g., `Song: 110 BPM (+8)`) with a 1-tap `[ ↺ 110 BPM ]` reset button to restore the original tempo.

### 3. Ambient Auto-BPM Detector
- Real-time tempo detection using the device microphone.
- Multi-band spectral flux + 5-second circular autocorrelation novelty tracker.
- Scrolling visual beat dots, mic energy meter, and half/double tempo octave adjusters.
- 1-click apply to metronome.

### 4. Chromatic Instrument Tuner
- Real-time pitch detection via autocorrelation.
- Visual cent needle, note name, octave, and frequency (Hz) display.
- Guitar & Bass presets (Standard, Drop D, DADGAD, Open G, 4/5-String Bass) with target note guidance.

### 5. Concert Gadgets (Audience Stage Beacons)
- Fullscreen pure black stage beacons to shine towards the stage during concerts:
  - **Lighter / Candle Flame**: Realistic flickering candle flame or classic Bic lighter with gas valve control.
  - **LED Banner**: High-contrast scrolling text marquee with user presets, emojis, and visual effects (Static, Scroll, Zoom Pulse, Neon Flicker, Glitch, Rainbow Disco).
  - **Neon Glowstick**: Vibrantly colored festival lightstick with tap-to-change colors and smooth rainbow cycle mode.
  - **Pulsing Heart**: Luminous double-beat pulsing heart for concert slow ballads.
- Automatic **Screen WakeLock** keeps displays active at 100% brightness while held overhead.

---

## Technology Stack

- **Pure Procedural JavaScript**: Lightweight, modular, zero heavyweight frameworks.
- **Bootstrap 5 & Bootstrap Icons**: Modern responsive layout optimized for mobile screens.
- **Web Audio API**: Real-time DSP audio generation and hardware-synchronized scheduling.
- **PWA Ready**: Offline caching with Service Worker and home-screen installability.

---

## License

MIT License. Created by [Vincent Borghi](https://github.com/vincentborghi).
