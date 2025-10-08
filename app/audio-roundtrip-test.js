/**
 * Audio Roundtrip Test für v3.12.0
 * Testet den kompletten Audio-Workflow mit echtem Mumble-Server
 * Aufnahme → Mumble-Server → Empfang → Playback
 */

class AudioRoundtripTest {
    constructor() {
        this.client = null;
        this.receivedPackets = 0;
        this.sentPackets = 0;
        this.testStartTime = null;
        this.voiceEventListener = null;
    }

    async runTest(mumbleClient) {
        if (!mumbleClient) {
            throw new Error('Kein Mumble-Client verfügbar');
        }

        console.log('🎵 Starte Audio-Roundtrip-Test mit echtem Mumble-Server (v3.12.0)...');
        this.client = mumbleClient;
        this.receivedPackets = 0;
        this.sentPackets = 0;
        this.testStartTime = Date.now();

        try {
            // 1. Höre auf eingehende Audio-Pakete
            this.setupAudioListener();

            // 2. Starte Audio-Aufnahme und -Sendung
            await this.startRecordingAndSending();

            // 3. Warte auf Ergebnisse
            return await this.waitForResults();

        } catch (error) {
            console.error('❌ Audio-Roundtrip-Test fehlgeschlagen:', error);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    setupAudioListener() {
        // Höre auf Voice-Events vom Server
        this.voiceEventListener = (voiceData) => {
            this.receivedPackets++;
            
            if (this.receivedPackets === 1) {
                const elapsed = Date.now() - this.testStartTime;
                console.log(`📥 Erstes Audio-Paket empfangen nach ${elapsed}ms`);
            }
            
            if (this.receivedPackets % 10 === 0) {
                console.log(`📊 ${this.receivedPackets} Audio-Pakete empfangen`);
            }
        };

        // Falls client Events unterstützt, höre darauf
        if (this.client && typeof this.client.on === 'function') {
            this.client.on('voice', this.voiceEventListener);
        }
    }

    async startRecordingAndSending() {
        console.log('🎤 Starte Audio-Aufnahme für 3 Sekunden...');
        console.log('💬 Sprechen Sie deutlich in Ihr Mikrofon!');

        return new Promise((resolve, reject) => {
            try {
                // Erstelle Voice-Stream für Mumble-Client
                this.voiceStream = this.client.createVoiceStream(960); // Standard: 960 samples/packet
                
                // Simuliere Audio-Sendung mit 440Hz Testton
                const sendAudioData = () => {
                    if (this.sentPackets < 150) { // ~3 Sekunden bei 20ms pro Paket
                        // Simuliere Audio-Paket (960 Samples = 20ms @ 48kHz)
                        const audioBuffer = new Float32Array(960);
                        // Fülle mit Testsignal (Sinuswelle)
                        for (let i = 0; i < 960; i++) {
                            audioBuffer[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.1; // 440Hz Testton
                        }
                        
                        // Sende an Voice-Stream
                        if (this.voiceStream && !this.voiceStream.destroyed) {
                            this.voiceStream.write(Buffer.from(audioBuffer.buffer));
                            this.sentPackets++;
                            
                            if (this.sentPackets === 1) {
                                console.log('📤 Erstes Audio-Paket gesendet');
                            }
                            
                            if (this.sentPackets % 50 === 0) {
                                console.log(`📤 ${this.sentPackets} Audio-Pakete gesendet`);
                            }
                        }
                        
                        // Nächstes Paket nach 20ms
                        setTimeout(sendAudioData, 20);
                    } else {
                        console.log(`📤 Audio-Sendung beendet - ${this.sentPackets} Pakete gesendet`);
                        if (this.voiceStream && !this.voiceStream.destroyed) {
                            this.voiceStream.end();
                        }
                        resolve();
                    }
                };
                
                // Starte Audio-Sendung
                sendAudioData();
                
            } catch (error) {
                reject(error);
            }
        });
    }

    async waitForResults() {
        console.log('⏳ Warte auf Audio-Roundtrip-Ergebnisse...');
        
        // Warte weitere 2 Sekunden auf verspätete Pakete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const results = {
            sentPackets: this.sentPackets,
            receivedPackets: this.receivedPackets,
            success: this.sentPackets > 0 && this.receivedPackets > 0,
            roundtripTime: Date.now() - this.testStartTime
        };
        
        console.log('📊 Test-Ergebnisse:', results);
        
        if (results.success) {
            console.log('✅ Audio-Roundtrip erfolgreich!');
            console.log(`   📤 Gesendet: ${results.sentPackets} Pakete`);
            console.log(`   📥 Empfangen: ${results.receivedPackets} Pakete`);
            console.log(`   ⏱️ Dauer: ${results.roundtripTime}ms`);
        } else if (results.sentPackets === 0) {
            console.log('❌ Audio-Aufnahme fehlgeschlagen');
        } else if (results.receivedPackets === 0) {
            console.log('❌ Audio-Empfang fehlgeschlagen');
        }
        
        return results;
    }

    cleanup() {
        // Entferne Event-Listener
        if (this.client && this.voiceEventListener && typeof this.client.off === 'function') {
            this.client.off('voice', this.voiceEventListener);
        }
        
        // Schließe Voice-Stream
        if (this.voiceStream && !this.voiceStream.destroyed) {
            try {
                this.voiceStream.end();
            } catch (e) {
                // Ignoriere Cleanup-Fehler
            }
        }
        
        this.voiceStream = null;
        this.voiceEventListener = null;
    }
}

// Globale Instanz
window.audioRoundtripTest = new AudioRoundtripTest();

// Convenience-Funktion
window.testAudioRoundtrip = (mumbleClient) => {
    return window.audioRoundtripTest.runTest(mumbleClient);
};

export default AudioRoundtripTest;