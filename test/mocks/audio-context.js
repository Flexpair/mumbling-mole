// Mock audio-context module for testing
export default function getAudioContext() {
  return {
    createOscillator: () => ({}),
    createGain: () => ({}),
    createAnalyser: () => ({}),
    createScriptProcessor: () => ({}),
    createMediaStreamSource: () => ({}),
    destination: {},
    sampleRate: 44100,
    currentTime: 0,
    state: 'running',
    suspend: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
}
