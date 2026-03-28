/**
 * Barrel Export Tests
 * 
 * Tests that all barrel index.js files correctly export their modules
 */
import { describe, it, expect } from '@jest/globals';

describe('Barrel Exports', () => {
  describe('app/mumble-client/index.js', () => {
    it('should export default MumbleClient', async () => {
      const module = await import('../app/mumble-client/index.js');
      expect(module.default).toBeDefined();
    });

    it('should export MumbleClient named', async () => {
      const { MumbleClient } = await import('../app/mumble-client/index.js');
      expect(MumbleClient).toBeDefined();
    });

    it('should export User', async () => {
      const { User } = await import('../app/mumble-client/index.js');
      expect(User).toBeDefined();
    });

    it('should export Channel', async () => {
      const { Channel } = await import('../app/mumble-client/index.js');
      expect(Channel).toBeDefined();
    });
  });

  describe('app/composables/index.js', () => {
    it('should export useLocalStorage', async () => {
      const { useLocalStorage } = await import('../app/composables/index.js');
      expect(useLocalStorage).toBeDefined();
      expect(typeof useLocalStorage).toBe('function');
    });

    it('should export vTooltip', async () => {
      const { vTooltip } = await import('../app/composables/index.js');
      expect(vTooltip).toBeDefined();
    });

    it('should export useClipboard', async () => {
      const { useClipboard } = await import('../app/composables/index.js');
      expect(useClipboard).toBeDefined();
      expect(typeof useClipboard).toBe('function');
    });

    it('should export announceToScreenReader', async () => {
      const { announceToScreenReader } = await import('../app/composables/index.js');
      expect(announceToScreenReader).toBeDefined();
      expect(typeof announceToScreenReader).toBe('function');
    });

    it('should export useFocusTrap', async () => {
      const { useFocusTrap } = await import('../app/composables/index.js');
      expect(useFocusTrap).toBeDefined();
      expect(typeof useFocusTrap).toBe('function');
    });

    it('should export useRovingTabindex', async () => {
      const { useRovingTabindex } = await import('../app/composables/index.js');
      expect(useRovingTabindex).toBeDefined();
      expect(typeof useRovingTabindex).toBe('function');
    });
  });

  describe('app/stores/index.js', () => {
    it('should export useConnectionStore', async () => {
      const { useConnectionStore } = await import('../app/stores/index.js');
      expect(useConnectionStore).toBeDefined();
      expect(typeof useConnectionStore).toBe('function');
    });

    it('should export useAudioStore', async () => {
      const { useAudioStore } = await import('../app/stores/index.js');
      expect(useAudioStore).toBeDefined();
      expect(typeof useAudioStore).toBe('function');
    });

    it('should export useVoiceStore', async () => {
      const { useVoiceStore } = await import('../app/stores/index.js');
      expect(useVoiceStore).toBeDefined();
      expect(typeof useVoiceStore).toBe('function');
    });

    it('should export useUIStore', async () => {
      const { useUIStore } = await import('../app/stores/index.js');
      expect(useUIStore).toBeDefined();
      expect(typeof useUIStore).toBe('function');
    });

    it('should export useUserStore', async () => {
      const { useUserStore } = await import('../app/stores/index.js');
      expect(useUserStore).toBeDefined();
      expect(typeof useUserStore).toBe('function');
    });

    it('should export useSettingsStore', async () => {
      const { useSettingsStore } = await import('../app/stores/index.js');
      expect(useSettingsStore).toBeDefined();
      expect(typeof useSettingsStore).toBe('function');
    });

    it('should export useDialogStore', async () => {
      const { useDialogStore } = await import('../app/stores/index.js');
      expect(useDialogStore).toBeDefined();
      expect(typeof useDialogStore).toBe('function');
    });
  });
});
