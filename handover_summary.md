# CarPlay Video Debugging Handover

## Project Overview
**Goal:** Run Apple CarPlay on a Raspberry Pi 4 (Headless) and view the interface remotely via a web browser on a Mac.
**Stack:**
- **Hardware:** Raspberry Pi 4, Carlinkit CPC200-CCPA Dongle.
- **Backend:** Node.js (`node-carplay` fork), Socket.IO.
- **Frontend:** React, `jmuxer` (H.264 decoder), Socket.IO Client.

## The Core Problem: "The Black Screen"
The remote video stream fails to decode (black screen) on the Pi, even though the connection is established and data is flowing.

### Root Cause Analysis
1.  **H.264 Requirement:** The decoder (`jmuxer`) needs **SPS (Sequence Parameter Set)** and **PPS (Picture Parameter Set)** headers to initialize. These are usually the first packets sent by the dongle.
2.  **Pi USB Instability:** On macOS, we use `device.reset()` to force the dongle to restart and resend these headers. On Raspberry Pi (Linux), `device.reset()` causes a **`LIBUSB_ERROR_NOT_FOUND` crash loop** due to unstable USB re-enumeration.
3.  **The Compromise:** We **disabled `device.reset()` on Linux** (via a patch to `node-carplay`).
4.  **The Consequence:** When the backend connects to an already-powered dongle (without reset), it joins the stream "mid-broadcast" and **misses the initial SPS/PPS headers**. Without them, the video cannot decode.

## Current Solution Strategy: "Key Learning"
To fix this without crashing the Pi, we implemented a persistence mechanism:

1.  **Capture (Mac):** The user runs the backend on a Mac (where USB is stable). The backend scans the video stream, detects SPS/PPS NAL units, and saves them to `config/sps_pps.json`.
2.  **Deploy (Pi):** This file is synced to the Pi.
3.  **Replay (Pi):** On startup, the Pi backend loads these keys. When a client connects, it **immediately sends the cached SPS/PPS** before forwarding the live stream.

## Current Status
- **Backend:** Implemented and working.
    - `carplay_server.mjs` successfully saves keys to `config/sps_pps.json`.
    - `carplay_server.mjs` successfully loads and emits cached keys on connection.
    - **Scanner:** Uses `Buffer.indexOf` to find NALs (supports both raw and Annex B formats).
- **Frontend:** **Partially Broken / Unstable.**
    - Receives the cached keys.
    - Receives the live stream.
    - **Issue:** `CarPlay.jsx` was blindly prepending Annex B start codes (`00 00 00 01`) to *all* data.
    - **Hypothesis:** The "Cached Keys" might be raw NALs (need start codes), but the "Live Stream" might *already* have start codes (or vice versa). Double-prepending corrupts the stream for `jmuxer`.

## Next Steps for Fresh Agent
1.  **Analyze Data Formats:**
    - Determine if `config/sps_pps.json` contains Raw NALs or Annex B (with `00 00 00 01`).
    - Determine if the live video data from `node-carplay` on Pi is Raw or Annex B.
2.  **Fix Frontend Normalization (`CarPlay.jsx`):**
    - Ensure `CarPlay.jsx` inspects *every* packet.
    - If it has a start code -> Pass through.
    - If it's raw -> Prepend start code.
    - **Goal:** `jmuxer` must receive a consistent stream of `[Start Code] [NAL] [Start Code] [NAL]`.
3.  **Verify `jmuxer` Config:** Ensure `flushingTime` and `mode` are optimized for this "stitched" stream.

## Key Files
- `backend/carplay_server.mjs`: Key learning logic, NAL scanner, caching.
- `frontend/src/components/CarPlay.jsx`: Socket handling, `jmuxer` feed, start code prepending.
- `backend/patches/node-carplay+4.3.0.patch`: Disables `device.reset()` on Linux.
