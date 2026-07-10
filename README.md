# 🎹 Launchkey Light Station MK4

<p align="center">
  <b>English</b> | <a href="README_zh.md">简体中文</a>
</p>

> A Web MIDI visualizer and functional harmony workstation designed for the **Novation Launchkey 25/37/49/61 MK4 （Regular and MINI）** series.

## ✨ Core Features

- **Real-time Harmony Analysis**: Analyzes played MIDI notes to accurately identify chords and the current key signature.
- **T/S/D Functional Lighting**: Maps the recognized chords to Tonic (T), Subdominant (S), or Dominant (D) functional groups, rendering specific colors on the Launchkey's pads.
- **Hardware Integration**: Uses Web MIDI API to send SysEx messages, providing synchronized, lag-free lighting feedback directly on the Launchkey MK4 pads.
- **Interactive Visuals**: Features a WebGL-based background that reacts to the MIDI velocity envelope, matching the current harmonic color.
- **Progressive Web App (PWA)**: Designed with a glassmorphism UI. It can be installed on mobile devices and operates fully offline.

## ⚙️ How to Use

1. **Connect your Launchkey MK4**: Use a USB OTG cable to connect the Launchkey to your smartphone, tablet, or computer.
2. **Access the Workstation**: Open the [Live Demo](https://easyhard007.github.io/LaunchkeyLightController/)) in Google Chrome or Safari.
   * *Tip: Use "Add to Home Screen" for a fullscreen, native app-like experience.*
3. **Configure the Port**: 
   - Click the `?` floating button in the bottom-left corner.
   - Select your hardware model (Mini or Regular).
   - Select the **DAW Port** (e.g., `MIDIIN2` or `Launchkey DAW`). *Do not select the standard MIDI port.*
4. **Initialize**: Click **"Start"**. The pads on your Launchkey will flash white twice, indicating that DAW control mode is active.
5. **Play**: Play chords on your keyboard. The pads will light up based on the functional harmony of your performance.

## 🛠️ Technical Details

- **Chord & Scale Engine**: Built upon `Tonal.js`. Implements a custom top-note pruning algorithm and a bass-interval fallback logic to accurately identify shell voicings and passing chords.
- **Rendering & Throttling**: Separates UI rendering (60Hz) from MIDI SysEx transmission (30Hz limit). A dirty-state caching mechanism ensures only essential color updates are sent, preventing hardware buffer overflow.
- **Smoothing Envelope**: Applies an Asymmetric Exponential Smoothing algorithm (fast attack, slow release) to the MIDI velocity, creating a natural lighting fade-out effect.

## 📜 License
Apache-2.0 license
