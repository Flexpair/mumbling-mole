/**
 * mumble-client/utils Tests
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Dynamic import because the path resolution is tricky
let getOSName, getOSVersion;

describe('mumble-client utils', () => {
  beforeEach(async () => {
    const utils = await import('../app/mumble-client/utils.js');
    getOSName = utils.getOSName;
    getOSVersion = utils.getOSVersion;
  });
  describe('getOSName', () => {
    it('should return "Browser" when window is defined', () => {
      // window is defined in jsdom environment
      expect(getOSName()).toBe('Browser');
    });
  });

  describe('getOSVersion', () => {
    it('should return navigator.userAgent when in browser', () => {
      // In jsdom, navigator.userAgent is defined
      const result = getOSVersion();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

