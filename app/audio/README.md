# Audio Pipeline

Mumbling Mole transports Mumble voice through the browser Web Audio API. The browser captures microphone input with an AudioWorklet, encodes Opus frames in a worker, sends them through the WebSocket tunnel, and decodes received frames before playback.

## Pipeline

```text
Microphone
   │
   ▼
AudioContext (48 kHz)
   │
   ▼
recorder-worker.js (AudioWorklet, 960 samples)
   │
   ▼
encode-worker.js (Opus/WASM)
   │
   ▼
Web Worker → WebSocket → websockify → Mumble TCP
   │
   ▼
decode-worker.js (Opus/WASM)
   │
   ▼
jitter/buffer queue → AudioContext.destination
```

The main-thread coordination is owned by the Pinia audio and voice stores. The protocol worker remains responsible for Mumble stream events; the audio workers remain isolated from Vue and cannot use application imports.

## Audio contract

These values are protocol and timing invariants:

- Sample rate: **48,000 Hz**.
- Sender frame size: **960 samples**.
- Frame duration: **20 ms** (`960 / 48,000`).
- Codec: **Opus**, compiled to WebAssembly.
- Transport: **WebSocket tunnel**, not WebRTC.
- Local Mumble endpoint in Compose: `murmur:64738`.

A sender that emits a different frame size changes the packet timing expected by the encoder and receiver. Keep the frame-size assertion and the loopback coverage in sync with any audio change.

## Capture and playback

`recorder-worker.js` runs as an AudioWorklet processor and forwards 960-sample blocks to the voice path. `encode-worker.js` converts those blocks to Opus. On reception, `decode-worker.js` produces PCM data for the playback buffer queue, which smooths packet timing before connecting to the audio destination.

The shared audio-context manager owns creation, reuse, resume handling, and diagnostic state. Do not call `new AudioContext()` from a component or store. Browser autoplay rules can leave the context suspended until a user interaction; the connect/test action is the supported activation point.

## Loopback test

The built-in audio test sends through the Mumble server's loopback target and returns the audio to the same browser. It validates capture, encoding, worker communication, WebSocket transport, decoding, buffering, and local playback. It does not validate remote-user lifecycle or client-to-client timing; use two clients for that scenario.

Run it with:

```bash
npm run test:loopback
npm run test:loopback:headed
npm run test:loopback:debug
```

The Playwright spec is `tests/playwright/loopback-frequency.spec.js`. It uses a fake Chromium microphone, grants microphone permission, and checks the 440 Hz test tone through the frequency display.

## Diagnostics

For a local two-client check:

1. Start the Compose services and build the application.
2. Open <https://local.flexpair.app> in two browser contexts.
3. Connect both clients to the same Mumble server.
4. Send voice from one client and inspect reception and playback in the other.
5. Compare the browser audio state and worker logs if playback is missing.

Useful local commands:

```bash
npm run build
./start-dev-server.sh
tail -f /tmp/entrypoint.log
tail -f /tmp/auth-server.log
```

The entrypoint serves static files on port `8081` when `SKIP_TUNNEL=1`; the normal path starts websockify on `8081` and the authentication service on `8082`. nginx exposes the browser-facing TLS endpoint on `443`.

## Common failures

| Symptom | Check |
| --- | --- |
| No microphone data | Browser permission, user interaction, and AudioContext state |
| No remote audio | Mumble/WebSocket connection, remote-user event registration, and decoder-worker errors |
| Clicks or unstable timing | 48 kHz context, 960-sample frames, packet ordering, and buffer queue state |
| Loopback passes but remote audio fails | Run a two-client test; loopback only exercises the local user path |
| Test cannot connect | Confirm the `murmur` Compose service is running on `murmur:64738` |

Do not put microphone data, access tokens, passwords, or returned credentials into logs or bug reports.
