/**
 * Performance Monitor for Mumbling Mole
 * 
 * Lightweight in-memory performance metrics collection for audio pipeline monitoring.
 * Tracks encoder/decoder latency, buffer health, and AudioContext state changes.
 * 
 * Usage:
 *   import performanceMonitor from './performance-monitor';
 *   
 *   performanceMonitor.mark('encode.start');
 *   // ... encoding work ...
 *   performanceMonitor.mark('encode.end');
 *   const duration = performanceMonitor.measure('encode.duration', 'encode.start', 'encode.end');
 *   
 *   // Get stats in console:
 *   window._performanceMonitor.getStats()
 */

const PERF_CONFIG = {
  MAX_ENTRIES: 1000,           // Keep last N metric entries
  MAX_MEASURES: 500,           // Keep last N measurements
  WARN_ENCODE_MS: 20,          // Warn if encoding takes > 20ms (frame is 20ms @ 48kHz)
  WARN_DECODE_MS: 20,          // Warn if decoding takes > 20ms
  WARN_LATENCY_MS: 100,        // Warn if end-to-end latency > 100ms
};

class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.measures = [];
    this.maxMetrics = 1000; // Ring buffer size for metrics
    this.maxMeasures = 10000; // Ring buffer size for measures (increased to capture all metric types)
    this.counters = {};          // Event counters (buffer underruns, etc.)
    this.enabled = true;
    
    // Expose to window for debugging
    if (typeof window !== 'undefined') {
      window._performanceMonitor = this;
    }
  }

  /**
   * Record a performance mark with optional metadata
   * @param {string} name - Mark name (e.g., 'encode.start')
   * @param {object} metadata - Optional metadata to attach
   */
  mark(name, metadata = {}) {
    if (!this.enabled) return;
    
    // Use native Performance API
    try {
      performance.mark(name);
    } catch (e) {
      // Ignore if Performance API unavailable (e.g., in workers)
    }
    
    this.metrics.push({
      type: 'mark',
      name,
      timestamp: performance.now(),
      metadata
    });
    
    this._trimMetrics();
  }

  /**
   * Measure duration between two marks
   * @param {string} name - Measurement name
   * @param {string} startMark - Start mark name
   * @param {string} endMark - End mark name
   * @returns {number} Duration in milliseconds
   */
  measure(name, startMark, endMark) {
    if (!this.enabled) return 0;
    
    console.log(`[PERF-MEASURE] Called measure('${name}', '${startMark}', '${endMark}')`);
    
    let duration = 0;
    
    try {
      const measure = performance.measure(name, startMark, endMark);
      duration = measure.duration;
      console.log(`[PERF-MEASURE] Performance.measure succeeded: ${duration.toFixed(2)}ms`);
    } catch (e) {
      // Fallback: manual calculation if Performance API fails
      const marks = this.metrics.filter(m => m.type === 'mark');
      const start = marks.find(m => m.name === startMark);
      const end = marks.find(m => m.name === endMark);
      
      if (start && end) {
        duration = end.timestamp - start.timestamp;
        console.log(`[PERF-MEASURE] Fallback calculation: ${duration.toFixed(2)}ms`);
      } else {
        console.error(`[PERF-MEASURE] Fallback failed - start: ${!!start}, end: ${!!end}`);
      }
      console.error('[PERF] Performance.measure failed, used fallback:', e.message);
    }
    
    this.measures.push({
      name,
      duration,
      timestamp: performance.now()
    });
    
    // Debug: log first few encode/decode measurements
    if ((name === 'encode.duration' || name === 'decode.duration') && this.measures.filter(m => m.name === name).length <= 3) {
      console.log(`[PERF-DEBUG] Added ${name} measure #${this.measures.filter(m => m.name === name).length}: ${duration.toFixed(2)}ms`);
    }
    
    this._trimMeasures();
    
    // Automatic warnings for slow operations
    this._checkThresholds(name, duration);
    
    return duration;
  }

  /**
   * Increment a counter (e.g., buffer underruns)
   * @param {string} name - Counter name
   * @param {number} increment - Amount to increment (default 1)
   */
  count(name, increment = 1) {
    if (!this.enabled) return;
    
    this.counters[name] = (this.counters[name] || 0) + increment;
    
    this.metrics.push({
      type: 'count',
      name,
      value: this.counters[name],
      timestamp: performance.now()
    });
    
    this._trimMetrics();
  }

  /**
   * Log a performance event (e.g., AudioContext state change)
   * @param {string} name - Event name
   * @param {object} data - Event data
   */
  event(name, data = {}) {
    if (!this.enabled) return;
    
    this.metrics.push({
      type: 'event',
      name,
      data,
      timestamp: performance.now()
    });
    
    this._trimMetrics();
    
    console.log(`[PERF] ${name}`, data);
  }

  /**
   * Check duration thresholds and warn if exceeded
   * @private
   */
  _checkThresholds(name, duration) {
    // Thresholds disabled - use Dashboard for performance analysis
    // Automatic console warnings create noise and are often false positives
    // during codec warmup or system load.
    return;
    
    /* Original threshold checking code (disabled):
    let threshold = null;
    
    if (name.includes('encode')) {
      threshold = PERF_CONFIG.WARN_ENCODE_MS;
    } else if (name.includes('decode')) {
      threshold = PERF_CONFIG.WARN_DECODE_MS;
    } else if (name.includes('latency')) {
      threshold = PERF_CONFIG.WARN_LATENCY_MS;
    }
    
    if (threshold && duration > threshold) {
      console.warn(`[PERF] Slow ${name}: ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }
    */
  }

  /**
   * Trim metrics to max entries (ring buffer)
   * @private
   */
  _trimMetrics() {
    if (this.metrics.length > this.maxEntries) {
      this.metrics = this.metrics.slice(-this.maxEntries);
    }
  }

  /**
   * Trim measures to max entries
   * @private
   */
  _trimMeasures() {
    if (this.measures.length > this.maxMeasures) {
      this.measures = this.measures.slice(-this.maxMeasures);
    }
  }

  /**
   * Get statistical summary of measurements
   * @param {string} measureName - Name of measurement to analyze
   * @returns {object} Statistics (avg, min, max, p95, p99, count)
   */
  getMeasureStats(measureName) {
    const measurements = this.measures
      .filter(m => m.name === measureName)
      .map(m => m.duration);
    
    if (measurements.length === 0) {
      return null;
    }
    
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    return {
      avg: sum / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: measurements.length
    };
  }

  /**
   * Get comprehensive performance statistics
   * @returns {object} All performance stats
   */
  getStats() {
    const stats = {
      enabled: this.enabled,
      metricsCount: this.metrics.length,
      measuresCount: this.measures.length,
      counters: { ...this.counters },
      measurements: {}
    };
    
    // Get stats for common measurements
    const commonMeasurements = [
      'encode.duration',
      'decode.duration',
      'audio.latency',
      'buffer.enqueue'
    ];
    
    commonMeasurements.forEach(name => {
      const measureStats = this.getMeasureStats(name);
      if (measureStats) {
        stats.measurements[name] = measureStats;
      }
    });
    
    // Recent events (last 10)
    stats.recentEvents = this.metrics
      .filter(m => m.type === 'event')
      .slice(-10)
      .map(e => ({ name: e.name, data: e.data, timestamp: e.timestamp }));
    
    return stats;
  }

  /**
   * Get recent metrics (for debugging)
   * @param {number} count - Number of recent entries to return
   * @returns {array} Recent metrics
   */
  getRecent(count = 20) {
    return this.metrics.slice(-count);
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
    this.measures = [];
    this.counters = {};
    
    // Clear Performance API marks/measures
    try {
      performance.clearMarks();
      performance.clearMeasures();
    } catch (e) {
      // Ignore if not available
    }
    
    console.log('[PERF] Metrics cleared');
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`[PERF] Monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Export metrics as JSON
   * @returns {string} JSON string of all metrics
   */
  export() {
    return JSON.stringify({
      metrics: this.metrics,
      measures: this.measures,
      counters: this.counters,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
