# Performance Monitor

Lightweight in-memory performance metrics collection for the Mumbling Mole audio pipeline.

## Features

- ✅ Zero external dependencies (uses native Performance API)
- ✅ Ring-buffer metric storage (last 1000 entries)
- ✅ Automatic threshold warnings (slow encode/decode detection)
- ✅ Statistical analysis (avg, min, max, p95, p99)
- ✅ Debug-friendly (accessible via `window._performanceMonitor`)

## Usage

### In Application Code

```javascript
import performanceMonitor from './performance-monitor';

// Mark a point in time
performanceMonitor.mark('operation.start');

// ... do work ...

// Mark end and measure duration
performanceMonitor.mark('operation.end');
const duration = performanceMonitor.measure('operation.duration', 'operation.start', 'operation.end');

// Count events
performanceMonitor.count('buffer.underruns');

// Log events
performanceMonitor.event('audiocontext.statechange', { state: 'running' });
```

### In Browser Console

```javascript
// Get comprehensive statistics
window._performanceMonitor.getStats()

// Example output:
{
  enabled: true,
  metricsCount: 523,
  measuresCount: 261,
  counters: {
    'audiocontext.suspensions': 2,
    'audiocontext.resumes': 3
  },
  measurements: {
    'encode.duration': {
      avg: 3.2,
      min: 1.8,
      max: 12.1,
      p50: 2.9,
      p95: 5.8,
      p99: 9.2,
      count: 152
    },
    'decode.duration': {
      avg: 2.8,
      min: 1.2,
      max: 8.9,
      p50: 2.5,
      p95: 4.2,
      p99: 6.1,
      count: 148
    }
  },
  recentEvents: [...]
}

// Get recent metrics
window._performanceMonitor.getRecent(20)

// Clear all metrics
window._performanceMonitor.clear()

// Export as JSON
console.log(window._performanceMonitor.export())

// Disable monitoring
window._performanceMonitor.setEnabled(false)
```

## Integration Points

### Audio Context Manager (`audio-context-manager.js`)
- Tracks AudioContext state changes (suspended → running → closed)
- Counts suspensions and resumes
- Logs state, sample rate, latency information

### Encoder (`encoder-stream.js`)
- Measures encoding duration (PCM → Opus)
- Warns if encoding takes > 20ms (frame duration)
- Tracks per-packet encoding performance

### Decoder (`decoder-stream.js`)
- Measures decoding duration (Opus → PCM)
- Warns if decoding takes > 20ms
- Tracks per-packet decoding performance

### Buffer Queue (`buffer-queue-node.js`)
- Measures buffer enqueue operations
- Tracks buffer health (underruns, overruns)
- Monitors playback pipeline

## Performance Thresholds

| Metric | Threshold | Reason |
|--------|-----------|--------|
| `encode.duration` | 20ms | Frame size is 20ms @ 48kHz; encoding must be faster than real-time |
| `decode.duration` | 20ms | Same as encoding; decoder must keep up with incoming stream |
| `audio.latency` | 100ms | End-to-end latency target for interactive voice communication |

Exceeding these thresholds triggers console warnings:
```
[PERF] Slow encoding: 24.32ms (threshold: 20ms)
```

## Configuration

Edit `/home/node/app/performance-monitor.js`:

```javascript
const PERF_CONFIG = {
  MAX_ENTRIES: 1000,      // Ring buffer size for metrics
  MAX_MEASURES: 500,      // Ring buffer size for measurements
  WARN_ENCODE_MS: 20,     // Encoding warning threshold
  WARN_DECODE_MS: 20,     // Decoding warning threshold
  WARN_LATENCY_MS: 100,   // Latency warning threshold
};
```

## Debugging Tips

### Audio Pipeline Issues

1. **Check recent events**:
   ```javascript
   window._performanceMonitor.getRecent(50).filter(m => m.type === 'event')
   ```

2. **Analyze encoding performance**:
   ```javascript
   window._performanceMonitor.getMeasureStats('encode.duration')
   ```

3. **Look for warnings**:
   - Filter browser console for `[PERF]` prefix
   - Check for "Slow encoding/decoding" messages

### Production Monitoring

Export metrics for analysis:
```javascript
// Copy to clipboard
copy(window._performanceMonitor.export())

// Or save to file
const blob = new Blob([window._performanceMonitor.export()], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `perf-metrics-${new Date().toISOString()}.json`;
a.click();
```

## Privacy

- **100% client-side**: All metrics stay in browser memory
- **No external calls**: No automatic reporting to analytics services
- **User-controlled**: Users can disable monitoring anytime
- **Ephemeral**: Metrics cleared on page reload (ring buffer only)

## Future Enhancements (Phase 2/3)

- [ ] Web Vitals integration (FCP, LCP, CLS, FID)
- [ ] Worker performance metrics (startup time, message latency)
- [ ] Optional analytics integration (PostHog, Plausible)
- [ ] Real-time dashboard UI
- [ ] Historical trend analysis
- [ ] Automated alerts/notifications

## References

- [User Timing API](https://developer.mozilla.org/en-US/docs/Web/API/User_Timing_API)
- [Performance Observer](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)
- Issue #156: Add Performance Monitoring for Audio Pipeline
