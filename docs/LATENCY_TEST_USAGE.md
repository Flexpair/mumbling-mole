# Latency Test Beep - Quick Usage Guide

## What Changed

The test tone now plays **both locally and as an echo from the Mumble server**, allowing you to hear the network latency.

## How to Use

1. **Connect to server** (loopback mode recommended for testing)
2. **Press and hold the Test button**
3. **Listen for two tones**:
   - **First tone** (immediate, slightly quieter): Local playback with 0ms latency
   - **Second tone** (delayed, slightly louder): Server echo with network latency
4. **Release the Test button**
5. **Calculate**: Time between the two tones = Your round-trip latency

## What You'll Hear

### Low Latency (5-20ms) - LAN/Local Server
- Both tones almost simultaneous
- Sounds like a slightly reinforced single tone
- Minimal perceptible delay

### Medium Latency (20-50ms) - Good Internet
- Clear short echo effect
- Two distinct but close tones
- Typical for good connections

### High Latency (100ms+) - Poor Connection
- Clear separation between tones
- Obvious echo effect
- Indicates connection issues

## Technical Details

### Audio Paths

**Local Path** (Immediate):
```
Oscillator → localGain (0.3) → AudioContext.destination → Speakers
```

**Server Echo Path** (Delayed):
```
Oscillator → beepGain (0.4) → Mixer → Encoder → WebSocket → 
Server (loopback) → WebSocket → Decoder → BufferQueueNode → Speakers
```

### Signal Characteristics
- **Frequency**: 440 Hz (A4 concert pitch)
- **Waveform**: Pure sine wave
- **Local volume**: 0.3 (quieter - immediate reference)
- **Echo volume**: 0.4 (louder - main signal path)
- **Attack time**: 5ms (smooth fade-in)
- **Release**: Piano-like envelope (300ms gentle + 1000ms decay)

## Console Output

When working correctly, you'll see:
```
[BEEP] Persistent beeper initialized with dual output (local + server echo) for latency testing
[BEEP] DUAL beep activated: local (immediate) + server echo (delayed) - listen for latency!
[VOICE] Audio data received, target: loopback, buffer size: ...
[BEEP] Dual fadeout: 0.3s gentle + 1.0s decay (local + echo)
```

## Troubleshooting

### Only local tone, no echo
- **Check**: Are you in loopback mode? (`ui.isLoopbackMode()`)
- **Check**: Is `window._audioMixer` available? (requires microphone permission)
- **Check**: Are you connected to the server?

### Only echo, no local tone
- **Unlikely**: Check browser console for errors in audio initialization

### Both tones at same time (no delay)
- **Normal**: Your connection is very fast (<10ms latency)
- **Try**: Testing over internet instead of LAN

### Very long delay (>200ms)
- **Network issue**: Check your internet connection
- **Server issue**: Check server performance
- **Expected**: If testing over long distances (intercontinental)

## Files Changed

- `/home/node/app/index.js`:
  - `_initializePersistentBeeper()`: Creates dual-output oscillator
  - `startBeep()`: Activates both local and remote paths
  - `stopBeep()`: Fades out both paths

## Development Notes

Built using Web Audio API:
- Single `OscillatorNode` split to two paths
- Separate `GainNode` for each path (local vs server)
- Permanent oscillator (always running at gain=0, activated on demand)
- Attack/release envelopes prevent audio clicks

---

**Author**: GitHub Copilot  
**Date**: October 14, 2025  
**Version**: 1.0  
