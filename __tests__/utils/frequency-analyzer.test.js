/**
 * Unit tests for frequency-analyzer.js
 * 
 * Tests FFT-based frequency detection used in loopback mode
 * to display dominant frequency (e.g., 440 Hz Piano button).
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock debug-utils
jest.unstable_mockModule('../../app/utils/debug-utils.js', () => ({
  debugLog: jest.fn()
}));

// Import after mocks
const { createFrequencyAnalyzer } = await import('../../app/utils/frequency-analyzer.js');

describe('Frequency Analyzer', () => {
  let mockAnalyserNode;
  let mockOnFrequencyUpdate;
  let mockIsMuted;
  let mockIsDeafened;
  let analyzer;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Mock AnalyserNode
    mockAnalyserNode = {
      frequencyBinCount: 16384, // FFT size 32768 / 2
      fftSize: 32768,
      context: {
        sampleRate: 48000 // Standard Web Audio sample rate
      },
      getByteFrequencyData: jest.fn((dataArray) => {
        // Default: No audio (all zeros)
        dataArray.fill(0);
      })
    };
    
    mockOnFrequencyUpdate = jest.fn();
    mockIsMuted = jest.fn(() => false);
    mockIsDeafened = jest.fn(() => false);
  });

  afterEach(() => {
    if (analyzer) {
      analyzer.stop();
    }
    jest.useRealTimers();
  });

  describe('Initialization and Lifecycle', () => {
    test('should create analyzer with required config', () => {
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened
      });
      
      expect(analyzer).toBeDefined();
      expect(analyzer.start).toBeInstanceOf(Function);
      expect(analyzer.stop).toBeInstanceOf(Function);
      expect(analyzer.getCurrentFrequency).toBeInstanceOf(Function);
    });

    test('should accept custom config values', () => {
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        updateIntervalMs: 50,
        amplitudeThreshold: 100,
        noAudioThreshold: 5
      });
      
      expect(analyzer).toBeDefined();
    });

    test('should start analysis loop', () => {
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        updateIntervalMs: 100
      });
      
      analyzer.start();
      
      // Advance timer to trigger analysis
      jest.advanceTimersByTime(100);
      
      expect(mockAnalyserNode.getByteFrequencyData).toHaveBeenCalled();
    });

    test('should not start multiple times', () => {
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        updateIntervalMs: 100
      });
      
      analyzer.start();
      analyzer.start(); // Second start
      
      jest.advanceTimersByTime(100);
      
      // Should only call once per interval, not twice
      expect(mockAnalyserNode.getByteFrequencyData).toHaveBeenCalledTimes(1);
    });

    test('should stop analysis loop', () => {
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        updateIntervalMs: 100
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      expect(mockAnalyserNode.getByteFrequencyData).toHaveBeenCalledTimes(1);
      
      analyzer.stop();
      jest.advanceTimersByTime(200); // More time
      
      // No additional calls after stop
      expect(mockAnalyserNode.getByteFrequencyData).toHaveBeenCalledTimes(1);
    });
  });

  describe('Frequency Detection', () => {
    test('should detect 440 Hz frequency (Piano A4)', () => {
      // Calculate bin index for 440 Hz
      // frequency = (index * sampleRate) / fftSize
      // 440 = (index * 48000) / 32768
      // index = (440 * 32768) / 48000 ≈ 300
      const targetFreq = 440;
      const binIndex = Math.round((targetFreq * mockAnalyserNode.fftSize) / mockAnalyserNode.context.sampleRate);
      
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[binIndex] = 200; // Strong signal at 440 Hz
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        amplitudeThreshold: 50
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      // Should report frequency close to 440 Hz
      expect(mockOnFrequencyUpdate).toHaveBeenCalled();
      const reportedFreq = mockOnFrequencyUpdate.mock.calls[0][0];
      expect(reportedFreq).toBeGreaterThan(430);
      expect(reportedFreq).toBeLessThan(450);
    });

    test('should detect highest amplitude frequency', () => {
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 80;  // Lower amplitude
        dataArray[200] = 150; // Highest amplitude (dominant)
        dataArray[300] = 90;  // Lower amplitude
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      // Should report frequency at bin 200
      const expectedFreq = (200 * 48000) / 32768;
      const reportedFreq = mockOnFrequencyUpdate.mock.calls[0][0];
      expect(reportedFreq).toBeCloseTo(expectedFreq, 0);
    });

    test('should ignore low amplitude signals', () => {
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 30; // Below threshold (50)
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        amplitudeThreshold: 50
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      // Should not report frequency (signal too weak)
      expect(mockOnFrequencyUpdate).not.toHaveBeenCalled();
    });

    test('should use custom amplitude threshold', () => {
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 80; // Above default (50) but below custom (100)
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        amplitudeThreshold: 100 // Custom threshold
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      // Should not report (below custom threshold)
      expect(mockOnFrequencyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Mute and Deaf Handling', () => {
    test('should not analyze when muted', () => {
      mockIsMuted = jest.fn(() => true); // Muted
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      // Should check mute status but not analyze
      expect(mockIsMuted).toHaveBeenCalled();
      expect(mockAnalyserNode.getByteFrequencyData).not.toHaveBeenCalled();
    });

    test('should not analyze when deafened', () => {
      mockIsDeafened = jest.fn(() => true); // Deafened
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      // Should check deaf status but not analyze
      expect(mockIsDeafened).toHaveBeenCalled();
      expect(mockAnalyserNode.getByteFrequencyData).not.toHaveBeenCalled();
    });

    test('should clear frequency when muted (on next tick)', () => {
      // Setup analyzer with audio
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 200; // Strong signal
      });
      
      // Use mockReturnValue so we can change it later
      const isMutedMock = jest.fn().mockReturnValue(false);
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: isMutedMock,
        isDeafened: mockIsDeafened
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      // Frequency detected
      expect(analyzer.getCurrentFrequency()).toBeGreaterThan(0);
      
      // Change mock to return true (muted)
      isMutedMock.mockReturnValue(true);
      
      // Run one more tick - should clear frequency
      jest.advanceTimersByTime(100);
      
      // Now frequency should be 0
      expect(analyzer.getCurrentFrequency()).toBe(0);
      
      // Should not analyze when muted
      const callsBeforeMute = mockAnalyserNode.getByteFrequencyData.mock.calls.length;
      jest.advanceTimersByTime(100);
      expect(mockAnalyserNode.getByteFrequencyData.mock.calls.length).toBe(callsBeforeMute);
    });
  });

  describe('No Audio Handling', () => {
    test('should clear display after consecutive checks without audio', () => {
      // First: strong signal
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 200;
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        noAudioThreshold: 3
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      expect(mockOnFrequencyUpdate).toHaveBeenCalledWith(expect.any(Number));
      mockOnFrequencyUpdate.mockClear();
      
      // Now: no audio
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0); // No signal
      });
      
      // First check: no clear yet
      jest.advanceTimersByTime(100);
      expect(mockOnFrequencyUpdate).not.toHaveBeenCalled();
      
      // Second check: still no clear
      jest.advanceTimersByTime(100);
      expect(mockOnFrequencyUpdate).not.toHaveBeenCalled();
      
      // Third check: should clear now
      jest.advanceTimersByTime(100);
      expect(mockOnFrequencyUpdate).toHaveBeenCalledWith(0);
    });

    test('should use custom no-audio threshold', () => {
      // Setup with frequency
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 200;
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        noAudioThreshold: 5 // Custom: 5 checks
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      mockOnFrequencyUpdate.mockClear();
      
      // Switch to no audio
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
      });
      
      // Should not clear after 3 checks
      jest.advanceTimersByTime(300);
      expect(mockOnFrequencyUpdate).not.toHaveBeenCalledWith(0);
      
      // Should clear after 5 checks
      jest.advanceTimersByTime(200); // Total 5
      expect(mockOnFrequencyUpdate).toHaveBeenCalledWith(0);
    });

    test('should reset no-audio counter when audio returns', () => {
      // Start with frequency
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 200;
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened,
        noAudioThreshold: 3
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      mockOnFrequencyUpdate.mockClear();
      
      // 2 checks without audio
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
      });
      jest.advanceTimersByTime(200);
      
      // Audio returns
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[100] = 200;
      });
      jest.advanceTimersByTime(100);
      
      expect(mockOnFrequencyUpdate).toHaveBeenCalledWith(expect.any(Number));
      mockOnFrequencyUpdate.mockClear();
      
      // Now needs 3 more checks to clear (counter was reset)
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
      });
      jest.advanceTimersByTime(200); // Only 2 checks
      expect(mockOnFrequencyUpdate).not.toHaveBeenCalledWith(0);
    });
  });

  describe('getCurrentFrequency()', () => {
    test('should return current frequency', () => {
      const binIndex = 300; // ~440 Hz
      mockAnalyserNode.getByteFrequencyData = jest.fn((dataArray) => {
        dataArray.fill(0);
        dataArray[binIndex] = 200;
      });
      
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened
      });
      
      analyzer.start();
      jest.advanceTimersByTime(100);
      
      const freq = analyzer.getCurrentFrequency();
      expect(freq).toBeGreaterThan(0);
      // FFT bin resolution isn't perfect, allow ±10 Hz tolerance
      expect(freq).toBeGreaterThan(430);
      expect(freq).toBeLessThan(450);
    });

    test('should return 0 when stopped', () => {
      analyzer = createFrequencyAnalyzer({
        analyserNode: mockAnalyserNode,
        onFrequencyUpdate: mockOnFrequencyUpdate,
        isMuted: mockIsMuted,
        isDeafened: mockIsDeafened
      });
      
      analyzer.start();
      analyzer.stop();
      
      expect(analyzer.getCurrentFrequency()).toBe(0);
    });
  });
});
