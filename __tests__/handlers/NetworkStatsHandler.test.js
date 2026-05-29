import { handlePing, handleServerSync } from '../../app/mumble-client/handlers/NetworkStatsHandler.js';
import { jest } from '@jest/globals';

describe('NetworkStatsHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('handlePing updates stats', () => {
    const client = {
      _dataStats: { update: jest.fn() },
      _inFlightDataPings: 1,
      emit: jest.fn()
    };
    // Mock Date.now() to return a fixed timestamp
    const now = Date.now();
    handlePing(client, {
      timestamp: { toNumber: () => now - 100 }
    });
    expect(client._dataStats.update).toHaveBeenCalledWith(100);
    expect(client.emit).toHaveBeenCalledWith('dataPing', 100);
    expect(client._inFlightDataPings).toBe(0);
  });

  it('handlePing ignores unexpected ping', () => {
    const client = {
      _inFlightDataPings: 0,
      _dataStats: { update: jest.fn() }
    };
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    handlePing(client, { timestamp: 100 });
    expect(consoleWarn).toHaveBeenCalled();
    expect(client._dataStats.update).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('handleServerSync sets up client and emits connected', () => {
    const user = { id: 5 };
    const client = {
      _userById: { 5: user },
      _inFlightDataPings: 0,
      _maxInFlightDataPings: 3,
      _dataPingInterval: 100,
      _dataStats: { getAll: () => ({ n: 10, mean: 5, variance: 1 }) },
      _voiceStats: { getAll: () => ({ n: 20, mean: 6, variance: 2 }) },
      _send: jest.fn(),
      emit: jest.fn()
    };
    handleServerSync(client, {
      session: 5,
      maxBandwidth: 120000,
      welcomeText: 'Hello'
    });

    expect(client.self).toBe(user);
    expect(client.maxBandwidth).toBe(120000);
    expect(client.welcomeMessage).toBe('Hello');
    expect(client.emit).toHaveBeenCalledWith('maxBandwidthChange', 120000);
    expect(client.emit).toHaveBeenCalledWith('connected');
    
    // Fast forward timer to trigger ping
    jest.advanceTimersByTime(150);
    expect(client._send).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ping' }));
    expect(client._inFlightDataPings).toBe(1);
    
    clearInterval(client._pinger);
  });

  it('handleServerSync emits timeout if maxInFlightDataPings reached', () => {
    const client = {
      _userById: {},
      _inFlightDataPings: 3, // Already at max
      _maxInFlightDataPings: 3,
      _dataPingInterval: 100,
      _error: jest.fn(),
      emit: jest.fn()
    };
    handleServerSync(client, { session: 1 });
    
    // Fast forward timer
    jest.advanceTimersByTime(150);
    expect(client._error).toHaveBeenCalledWith('timeout');
    
    clearInterval(client._pinger);
  });
});
