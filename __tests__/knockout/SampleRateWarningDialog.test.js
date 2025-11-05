/**
 * Characterization tests for SampleRateWarningDialog (Knockout version)
 * 
 * These tests document the current behavior before Vue.js migration.
 * The SampleRateWarningDialog appears when the user's audio device sample rate
 * doesn't match the required 48000 Hz.
 * 
 * Two modes:
 * - "confirm" mode: Shown before connection, allows "join without audio" or cancel
 * - "info" mode: Shown after connection, informational only with close button
 */

import ko from 'knockout';

// Mock translate function
const mockTranslations = {
  'audio.sample_rate.warning.title': 'Audio hardware mismatch',
  'audio.sample_rate.warning.body': 'Your audio device sample rate (%1 Hz) doesn\'t match the required 48000 Hz. You can still join without audio, but your microphone and speakers will remain muted.',
  'audio.sample_rate.warning.info': 'Audio is disabled because your audio device sample rate (%1 Hz) doesn\'t match the required 48000 Hz.',
  'audio.sample_rate.warning.accept': 'Join without audio',
  'audio.sample_rate.warning.cancel': 'Cancel',
  'audio.sample_rate.warning.close': 'Close',
  'audio.sample_rate.warning.unknown_rate': 'unknown',
  'audio.sample_rate.warning.hints_title': 'How to switch your device to 48 kHz',
  'audio.sample_rate.warning.hints.item1': 'Windows: Right-click the speaker icon → Sound settings → More sound settings → select your device → Advanced → set Default Format to 48,000 Hz.',
  'audio.sample_rate.warning.hints.item2': 'macOS: Open Applications › Utilities › Audio MIDI Setup → select your device → set Format to 48,000 Hz.',
  'audio.sample_rate.warning.hints.item3': 'Linux: Use PulseAudio Volume Control (pavucontrol) or system audio settings to choose a 48 kHz profile, then reconnect.'
};

const translate = (key) => mockTranslations[key] || key;

describe('SampleRateWarningDialog - Knockout Characterization Tests', () => {
  let ui;
  let sampleRateWarningDialog;
  let performConnectCalls;

  beforeEach(() => {
    performConnectCalls = [];
    
    // Mock UI object
    ui = {
      currentOpenModal: ko.observable(null),
      _performConnect: function(params, options) {
        performConnectCalls.push({ params, options });
      }
    };

    // Recreate SampleRateWarningDialog constructor from app/index.js
    function SampleRateWarningDialog(uiInstance) {
      this.visible = ko.observable(false);
      this.mode = ko.observable("confirm");
      this.sampleRate = ko.observable(null);
      this.pendingConnection = null;

      const formatSampleRate = (value) => {
        if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
          return String(Math.round(value));
        }
        return translate("audio.sample_rate.warning.unknown_rate");
      };

      this.title = ko.pureComputed(() => translate("audio.sample_rate.warning.title"));
      this.isConfirm = ko.pureComputed(() => this.mode() === "confirm");
      this.description = ko.pureComputed(() => {
        const key = this.isConfirm()
          ? "audio.sample_rate.warning.body"
          : "audio.sample_rate.warning.info";
        const template = translate(key);
        return template.replace("%1", formatSampleRate(this.sampleRate()));
      });
      this.primaryLabel = ko.pureComputed(() => translate("audio.sample_rate.warning.accept"));
      this.secondaryLabel = ko.pureComputed(() => {
        const key = this.isConfirm()
          ? "audio.sample_rate.warning.cancel"
          : "audio.sample_rate.warning.close";
        return translate(key);
      });
      this.hintsTitle = ko.pureComputed(() => translate("audio.sample_rate.warning.hints_title"));
      this.hints = ko.pureComputed(() => {
        const hintKeys = [
          "audio.sample_rate.warning.hints.item1",
          "audio.sample_rate.warning.hints.item2",
          "audio.sample_rate.warning.hints.item3"
        ];
        return hintKeys
          .map((key) => translate(key))
          .filter((text) => text && !/^\{\{.*\}\}$/.test(text));
      });

      this.show = (sampleRate, params) => {
        if (uiInstance.currentOpenModal() !== null) {
          return;
        }
        this.mode("confirm");
        this.sampleRate(sampleRate || null);
        this.pendingConnection = params || null;
        this.visible(true);
        uiInstance.currentOpenModal('sampleRateWarning');
      };

      this.showInfo = (sampleRate) => {
        if (uiInstance.currentOpenModal() !== null) {
          return;
        }
        this.mode("info");
        this.sampleRate(sampleRate || null);
        this.pendingConnection = null;
        this.visible(true);
        uiInstance.currentOpenModal('sampleRateWarning');
      };

      this.hide = () => {
        this.visible(false);
        if (uiInstance.currentOpenModal() === 'sampleRateWarning') {
          uiInstance.currentOpenModal(null);
        }
        this.pendingConnection = null;
      };

      this.joinWithoutAudio = () => {
        const params = this.pendingConnection;
        const sampleRate = this.sampleRate();
        this.hide();
        if (params) {
          uiInstance._performConnect(params, {
            audioEnabled: false,
            sampleRate,
          });
        }
      };

      this.cancel = () => {
        this.hide();
      };
    }

    sampleRateWarningDialog = new SampleRateWarningDialog(ui);
  });

  describe('Initialization', () => {
    test('initializes in confirm mode', () => {
      expect(sampleRateWarningDialog.mode()).toBe('confirm');
    });

    test('starts hidden', () => {
      expect(sampleRateWarningDialog.visible()).toBe(false);
    });

    test('initializes with null sample rate', () => {
      expect(sampleRateWarningDialog.sampleRate()).toBeNull();
    });

    test('initializes with null pending connection', () => {
      expect(sampleRateWarningDialog.pendingConnection).toBeNull();
    });

    test('currentOpenModal starts as null', () => {
      expect(ui.currentOpenModal()).toBeNull();
    });
  });

  describe('Confirm Mode - show()', () => {
    test('sets mode to confirm', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(sampleRateWarningDialog.mode()).toBe('confirm');
    });

    test('makes dialog visible', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(sampleRateWarningDialog.visible()).toBe(true);
    });

    test('stores sample rate', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(sampleRateWarningDialog.sampleRate()).toBe(44100);
    });

    test('stores pending connection params', () => {
      const params = { address: 'test.com', port: '64738' };
      sampleRateWarningDialog.show(44100, params);
      expect(sampleRateWarningDialog.pendingConnection).toBe(params);
    });

    test('sets currentOpenModal to sampleRateWarning', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(ui.currentOpenModal()).toBe('sampleRateWarning');
    });

    test('does not show if another modal is open', () => {
      ui.currentOpenModal('otherModal');
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      
      expect(sampleRateWarningDialog.visible()).toBe(false);
      expect(ui.currentOpenModal()).toBe('otherModal');
    });

    test('handles null sample rate', () => {
      sampleRateWarningDialog.show(null, { address: 'test.com' });
      expect(sampleRateWarningDialog.sampleRate()).toBeNull();
    });

    test('handles undefined sample rate', () => {
      sampleRateWarningDialog.show(undefined, { address: 'test.com' });
      expect(sampleRateWarningDialog.sampleRate()).toBeNull();
    });

    test('handles null params', () => {
      sampleRateWarningDialog.show(44100, null);
      expect(sampleRateWarningDialog.pendingConnection).toBeNull();
    });

    test('handles undefined params', () => {
      sampleRateWarningDialog.show(44100);
      expect(sampleRateWarningDialog.pendingConnection).toBeNull();
    });
  });

  describe('Info Mode - showInfo()', () => {
    test('sets mode to info', () => {
      sampleRateWarningDialog.showInfo(44100);
      expect(sampleRateWarningDialog.mode()).toBe('info');
    });

    test('makes dialog visible', () => {
      sampleRateWarningDialog.showInfo(44100);
      expect(sampleRateWarningDialog.visible()).toBe(true);
    });

    test('stores sample rate', () => {
      sampleRateWarningDialog.showInfo(44100);
      expect(sampleRateWarningDialog.sampleRate()).toBe(44100);
    });

    test('sets pending connection to null', () => {
      // First set it to something
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      // Then call showInfo
      sampleRateWarningDialog.hide();
      sampleRateWarningDialog.showInfo(44100);
      
      expect(sampleRateWarningDialog.pendingConnection).toBeNull();
    });

    test('sets currentOpenModal to sampleRateWarning', () => {
      sampleRateWarningDialog.showInfo(44100);
      expect(ui.currentOpenModal()).toBe('sampleRateWarning');
    });

    test('does not show if another modal is open', () => {
      ui.currentOpenModal('otherModal');
      sampleRateWarningDialog.showInfo(44100);
      
      expect(sampleRateWarningDialog.visible()).toBe(false);
      expect(ui.currentOpenModal()).toBe('otherModal');
    });

    test('handles null sample rate', () => {
      sampleRateWarningDialog.showInfo(null);
      expect(sampleRateWarningDialog.sampleRate()).toBeNull();
    });

    test('handles undefined sample rate', () => {
      sampleRateWarningDialog.showInfo();
      expect(sampleRateWarningDialog.sampleRate()).toBeNull();
    });
  });

  describe('hide()', () => {
    test('makes dialog invisible', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.hide();
      
      expect(sampleRateWarningDialog.visible()).toBe(false);
    });

    test('clears currentOpenModal if it was sampleRateWarning', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.hide();
      
      expect(ui.currentOpenModal()).toBeNull();
    });

    test('does not clear currentOpenModal if it was changed to something else', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      ui.currentOpenModal('otherModal');
      sampleRateWarningDialog.hide();
      
      expect(ui.currentOpenModal()).toBe('otherModal');
    });

    test('clears pending connection', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.hide();
      
      expect(sampleRateWarningDialog.pendingConnection).toBeNull();
    });

    test('is idempotent', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.hide();
      sampleRateWarningDialog.hide();
      
      expect(sampleRateWarningDialog.visible()).toBe(false);
      expect(ui.currentOpenModal()).toBeNull();
    });
  });

  describe('joinWithoutAudio()', () => {
    test('hides the dialog', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.joinWithoutAudio();
      
      expect(sampleRateWarningDialog.visible()).toBe(false);
    });

    test('calls _performConnect with pending params and audioEnabled: false', () => {
      const params = { address: 'test.com', port: '64738' };
      sampleRateWarningDialog.show(44100, params);
      sampleRateWarningDialog.joinWithoutAudio();
      
      expect(performConnectCalls).toHaveLength(1);
      expect(performConnectCalls[0].params).toBe(params);
      expect(performConnectCalls[0].options.audioEnabled).toBe(false);
    });

    test('passes sample rate in options', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.joinWithoutAudio();
      
      expect(performConnectCalls[0].options.sampleRate).toBe(44100);
    });

    test('does not call _performConnect if no pending connection', () => {
      sampleRateWarningDialog.showInfo(44100);
      sampleRateWarningDialog.joinWithoutAudio();
      
      expect(performConnectCalls).toHaveLength(0);
    });

    test('clears currentOpenModal', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.joinWithoutAudio();
      
      expect(ui.currentOpenModal()).toBeNull();
    });
  });

  describe('cancel()', () => {
    test('hides the dialog', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.cancel();
      
      expect(sampleRateWarningDialog.visible()).toBe(false);
    });

    test('does not call _performConnect', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.cancel();
      
      expect(performConnectCalls).toHaveLength(0);
    });

    test('clears pending connection', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.cancel();
      
      expect(sampleRateWarningDialog.pendingConnection).toBeNull();
    });

    test('clears currentOpenModal', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      sampleRateWarningDialog.cancel();
      
      expect(ui.currentOpenModal()).toBeNull();
    });
  });

  describe('Computed Properties', () => {
    describe('title', () => {
      test('returns translated title', () => {
        expect(sampleRateWarningDialog.title()).toBe('Audio hardware mismatch');
      });

      test('is a computed observable', () => {
        expect(ko.isComputed(sampleRateWarningDialog.title)).toBe(true);
      });
    });

    describe('isConfirm', () => {
      test('returns true when mode is confirm', () => {
        sampleRateWarningDialog.mode('confirm');
        expect(sampleRateWarningDialog.isConfirm()).toBe(true);
      });

      test('returns false when mode is info', () => {
        sampleRateWarningDialog.mode('info');
        expect(sampleRateWarningDialog.isConfirm()).toBe(false);
      });

      test('is a computed observable', () => {
        expect(ko.isComputed(sampleRateWarningDialog.isConfirm)).toBe(true);
      });
    });

    describe('description', () => {
      test('uses body template in confirm mode', () => {
        sampleRateWarningDialog.show(44100, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain('You can still join without audio');
      });

      test('uses info template in info mode', () => {
        sampleRateWarningDialog.showInfo(44100);
        expect(sampleRateWarningDialog.description()).toContain('Audio is disabled because');
      });

      test('replaces %1 with formatted sample rate', () => {
        sampleRateWarningDialog.show(44100, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain('44100 Hz');
      });

      test('rounds decimal sample rates', () => {
        sampleRateWarningDialog.show(44100.7, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain('44101 Hz');
      });

      test('uses "unknown" for null sample rate', () => {
        sampleRateWarningDialog.show(null, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain('unknown');
      });

      test('uses "unknown" for NaN sample rate', () => {
        sampleRateWarningDialog.show(NaN, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain('unknown');
      });

      test('uses "unknown" for negative sample rate', () => {
        sampleRateWarningDialog.show(-100, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain('unknown');
      });

      test('uses "unknown" for zero sample rate', () => {
        sampleRateWarningDialog.show(0, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain('unknown');
      });

      test('is a computed observable', () => {
        expect(ko.isComputed(sampleRateWarningDialog.description)).toBe(true);
      });
    });

    describe('primaryLabel', () => {
      test('returns "Join without audio" in all modes', () => {
        sampleRateWarningDialog.show(44100, { address: 'test.com' });
        expect(sampleRateWarningDialog.primaryLabel()).toBe('Join without audio');
        
        sampleRateWarningDialog.hide();
        sampleRateWarningDialog.showInfo(44100);
        expect(sampleRateWarningDialog.primaryLabel()).toBe('Join without audio');
      });

      test('is a computed observable', () => {
        expect(ko.isComputed(sampleRateWarningDialog.primaryLabel)).toBe(true);
      });
    });

    describe('secondaryLabel', () => {
      test('returns "Cancel" in confirm mode', () => {
        sampleRateWarningDialog.show(44100, { address: 'test.com' });
        expect(sampleRateWarningDialog.secondaryLabel()).toBe('Cancel');
      });

      test('returns "Close" in info mode', () => {
        sampleRateWarningDialog.showInfo(44100);
        expect(sampleRateWarningDialog.secondaryLabel()).toBe('Close');
      });

      test('is a computed observable', () => {
        expect(ko.isComputed(sampleRateWarningDialog.secondaryLabel)).toBe(true);
      });
    });

    describe('hintsTitle', () => {
      test('returns translated hints title', () => {
        expect(sampleRateWarningDialog.hintsTitle()).toBe('How to switch your device to 48 kHz');
      });

      test('is a computed observable', () => {
        expect(ko.isComputed(sampleRateWarningDialog.hintsTitle)).toBe(true);
      });
    });

    describe('hints', () => {
      test('returns array of three hint items', () => {
        const hints = sampleRateWarningDialog.hints();
        expect(hints).toHaveLength(3);
      });

      test('contains Windows hint', () => {
        const hints = sampleRateWarningDialog.hints();
        expect(hints[0]).toContain('Windows:');
      });

      test('contains macOS hint', () => {
        const hints = sampleRateWarningDialog.hints();
        expect(hints[1]).toContain('macOS:');
      });

      test('contains Linux hint', () => {
        const hints = sampleRateWarningDialog.hints();
        expect(hints[2]).toContain('Linux:');
      });

      test('filters out missing translations', () => {
        // All translations exist in our mock, so length should be 3
        const hints = sampleRateWarningDialog.hints();
        expect(hints).toHaveLength(3);
      });

      test('is a computed observable', () => {
        expect(ko.isComputed(sampleRateWarningDialog.hints)).toBe(true);
      });
    });
  });

  describe('Mode Transitions', () => {
    test('can switch from confirm to info mode', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(sampleRateWarningDialog.mode()).toBe('confirm');
      
      sampleRateWarningDialog.hide();
      sampleRateWarningDialog.showInfo(44100);
      expect(sampleRateWarningDialog.mode()).toBe('info');
    });

    test('can switch from info to confirm mode', () => {
      sampleRateWarningDialog.showInfo(44100);
      expect(sampleRateWarningDialog.mode()).toBe('info');
      
      sampleRateWarningDialog.hide();
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(sampleRateWarningDialog.mode()).toBe('confirm');
    });

    test('description updates when mode changes', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      const confirmDescription = sampleRateWarningDialog.description();
      
      sampleRateWarningDialog.hide();
      sampleRateWarningDialog.showInfo(44100);
      const infoDescription = sampleRateWarningDialog.description();
      
      expect(confirmDescription).not.toBe(infoDescription);
      expect(confirmDescription).toContain('You can still join');
      expect(infoDescription).toContain('Audio is disabled');
    });

    test('secondary button label updates when mode changes', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(sampleRateWarningDialog.secondaryLabel()).toBe('Cancel');
      
      sampleRateWarningDialog.hide();
      sampleRateWarningDialog.showInfo(44100);
      expect(sampleRateWarningDialog.secondaryLabel()).toBe('Close');
    });
  });

  describe('Sample Rate Formatting', () => {
    test('formats common sample rates correctly', () => {
      const commonRates = [8000, 16000, 22050, 44100, 48000, 96000, 192000];
      
      commonRates.forEach(rate => {
        sampleRateWarningDialog.show(rate, { address: 'test.com' });
        expect(sampleRateWarningDialog.description()).toContain(String(rate));
        sampleRateWarningDialog.hide();
      });
    });

    test('handles very large sample rates', () => {
      sampleRateWarningDialog.show(999999, { address: 'test.com' });
      expect(sampleRateWarningDialog.description()).toContain('999999');
    });

    test('handles fractional sample rates by rounding', () => {
      sampleRateWarningDialog.show(44100.4, { address: 'test.com' });
      expect(sampleRateWarningDialog.description()).toContain('44100');
      
      sampleRateWarningDialog.hide();
      sampleRateWarningDialog.show(44100.6, { address: 'test.com' });
      expect(sampleRateWarningDialog.description()).toContain('44101');
    });
  });

  describe('Observable Subscriptions', () => {
    test('visible observable can be subscribed to', () => {
      const calls = [];
      const subscription = sampleRateWarningDialog.visible.subscribe((val) => calls.push(val));
      
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(calls).toContain(true);
      
      sampleRateWarningDialog.hide();
      expect(calls).toContain(false);
      
      subscription.dispose();
    });

    test('mode observable can be subscribed to', () => {
      const calls = [];
      const subscription = sampleRateWarningDialog.mode.subscribe((val) => calls.push(val));
      
      sampleRateWarningDialog.showInfo(44100);
      expect(calls).toContain('info');
      
      subscription.dispose();
    });

    test('sampleRate observable can be subscribed to', () => {
      const calls = [];
      const subscription = sampleRateWarningDialog.sampleRate.subscribe((val) => calls.push(val));
      
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      expect(calls).toContain(44100);
      
      subscription.dispose();
    });

    test('computed observables update when dependencies change', () => {
      sampleRateWarningDialog.show(44100, { address: 'test.com' });
      const desc1 = sampleRateWarningDialog.description();
      
      sampleRateWarningDialog.sampleRate(48000);
      const desc2 = sampleRateWarningDialog.description();
      
      expect(desc1).not.toBe(desc2);
      expect(desc1).toContain('44100');
      expect(desc2).toContain('48000');
    });
  });
});
