/**
 * Audio Roundtrip Test für v3.12.0 - Korrigierte Version
 * Testet den kompletten Audio-Workflow mit echtem Mumble-Server
 * Aufnahme → Mumble-Server → Empfang → Playback
 * 
 * HINWEIS: Da Mumble normalerweise kein Echo/Loopback hat,
 * testen wir stattdessen, ob Audio erfolgreich gesendet werden kann
 * und ob das System grundsätzlich funktioniert.
 */

class AudioRoundtripTest {
    constructor() {
        this.client = null;
        this.receivedPackets = 0;
        this.sentPackets = 0;
        this.testStartTime = null;
        this.voiceEventListener = null;
        this.streamCreated = false;
        this.streamErrors = [];
    }

    async runTest(mumbleClient) {
        if (!mumbleClient) {
            throw new Error('Kein Mumble-Client verfügbar');
        }

        console.log('🎵 Starte Audio-Roundtrip-Test mit echtem Mumble-Server (v3.12.0)...');
        this.client = mumbleClient;
        this.receivedPackets = 0;
        this.sentPackets = 0;
        this.streamCreated = false;
        this.streamErrors = [];
        this.testStartTime = Date.now();

        try {
            // 1. Höre auf eingehende Audio-Pakete (von anderen Benutzern)
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
        console.log('🎧 Richte Audio-Listener ein...');
        
        // Höre auf Voice-Events vom Client
        this.voiceEventListener = (voiceStream) => {
            console.log('📥 Voice-Event empfangen, richte Stream-Listener ein');
            
            // Höre auf Daten vom Voice-Stream
            voiceStream.on('data', (data) => {
                this.receivedPackets++;
                
                if (this.receivedPackets === 1) {
                    const elapsed = Date.now() - this.testStartTime;
                    console.log(`📥 Erstes Audio-Paket empfangen nach ${elapsed}ms`);
                }
                
                if (this.receivedPackets % 10 === 0) {
                    console.log(`📊 ${this.receivedPackets} Audio-Pakete empfangen`);
                }
            });
            
            voiceStream.on('error', (err) => {
                console.error('❌ Voice-Stream-Fehler:', err);
            });
            
            voiceStream.on('end', () => {
                console.log('📤 Voice-Stream beendet');
            });
        };

        // Falls client Events unterstützt, höre darauf
        if (this.client && typeof this.client.on === 'function') {
            this.client.on('voice', this.voiceEventListener);
            console.log('✅ Voice-Event-Listener am Client registriert');
        } else {
            console.log('⚠️ Client unterstützt keine Events oder ist null');
        }
        
        // Zusätzlich: Höre auf Voice-Events von allen Benutzern
        if (this.client && this.client.users) {
            this.client.users.forEach(user => {
                if (user && typeof user.on === 'function') {
                    user.on('voice', this.voiceEventListener);
                    console.log(`✅ Voice-Event-Listener für Benutzer ${user.name || user.id} registriert`);
                }
            });
        }
    }

    async startRecordingAndSending() {
        console.log('🎤 Starte Audio-Aufnahme für 3 Sekunden...');
        console.log('💬 Sende synthetisches Audio-Signal (440Hz Testton)');

        return new Promise((resolve, reject) => {
            try {
                // Erstelle Voice-Stream für Mumble-Client
                console.log('🔧 Erstelle Voice-Stream...');
                this.voiceStream = this.client.createVoiceStream(960); // Standard: 960 samples/packet
                
                if (!this.voiceStream) {
                    throw new Error('Voice-Stream konnte nicht erstellt werden');
                }
                
                this.streamCreated = true;
                console.log('✅ Voice-Stream erfolgreich erstellt');
                
                // Voice-Stream Event-Handler
                this.voiceStream.on('error', (err) => {
                    console.error('❌ Voice-Stream-Fehler:', err);
                    this.streamErrors.push(err.message);
                });
                
                this.voiceStream.on('finish', () => {
                    console.log('📤 Voice-Stream beendet');
                });
                
                // Simuliere Audio-Sendung mit 440Hz Testton
                const sendAudioData = () => {
                    if (this.sentPackets < 150) { // ~3 Sekunden bei 20ms pro Paket
                        try {
                            // Simuliere Audio-Paket (960 Samples = 20ms @ 48kHz)
                            const audioBuffer = new Float32Array(960);
                            // Fülle mit Testsignal (Sinuswelle)
                            for (let i = 0; i < 960; i++) {
                                audioBuffer[i] = Math.sin(2 * Math.PI * 440 * (this.sentPackets * 960 + i) / 48000) * 0.1;
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
                            } else {
                                console.error('❌ Voice-Stream ist nicht verfügbar');
                                reject(new Error('Voice-Stream ist nicht verfügbar'));
                                return;
                            }
                            
                            // Nächstes Paket nach 20ms
                            setTimeout(sendAudioData, 20);
                        } catch (err) {
                            console.error('❌ Fehler beim Senden von Audio:', err);
                            reject(err);
                            return;
                        }
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
                console.error('❌ Fehler beim Starten der Audio-Sendung:', error);
                this.streamErrors.push(error.message);
                reject(error);
            }
        });
    }

    async waitForResults() {
        console.log('⏳ Warte auf Audio-Test-Ergebnisse...');
        
        // Warte weitere 2 Sekunden auf verspätete Pakete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const results = {
            sentPackets: this.sentPackets,
            receivedPackets: this.receivedPackets,
            streamCreated: this.streamCreated,
            streamErrors: this.streamErrors,
            success: false,
            roundtripTime: Date.now() - this.testStartTime
        };
        
        // Erfolgskriterien:
        // 1. Voice-Stream wurde erfolgreich erstellt
        // 2. Audio-Pakete wurden erfolgreich gesendet
        // 3. Keine kritischen Stream-Fehler
        if (this.streamCreated && this.sentPackets > 100 && this.streamErrors.length === 0) {
            results.success = true;
            console.log('✅ Audio-Sendung erfolgreich!');
            console.log(`   📤 Gesendet: ${results.sentPackets} Pakete`);
            console.log(`   📥 Empfangen: ${results.receivedPackets} Pakete (von anderen Benutzern)`);
            console.log(`   ⏱️ Dauer: ${results.roundtripTime}ms`);
        } else {
            console.log('❌ Audio-Test fehlgeschlagen:');
            if (!this.streamCreated) {
                console.log('   - Voice-Stream konnte nicht erstellt werden');
            }
            if (this.sentPackets <= 100) {
                console.log(`   - Zu wenige Pakete gesendet: ${this.sentPackets}`);
            }
            if (this.streamErrors.length > 0) {
                console.log(`   - Stream-Fehler: ${this.streamErrors.join(', ')}`);
            }
        }
        
        console.log('📊 Vollständige Test-Ergebnisse:', results);
        
        return results;
    }

    cleanup() {
        console.log('🧹 Cleanup wird durchgeführt...');
        
        // Entferne Event-Listener vom Client
        if (this.client && this.voiceEventListener && typeof this.client.off === 'function') {
            this.client.off('voice', this.voiceEventListener);
            console.log('✅ Voice-Event-Listener vom Client entfernt');
        }
        
        // Entferne Event-Listener von allen Benutzern  
        if (this.client && this.client.users) {
            this.client.users.forEach(user => {
                if (user && typeof user.off === 'function') {
                    user.off('voice', this.voiceEventListener);
                    console.log(`✅ Voice-Event-Listener von Benutzer ${user.name || user.id} entfernt`);
                }
            });
        }
        
        // Schließe Voice-Stream
        if (this.voiceStream && !this.voiceStream.destroyed) {
            try {
                this.voiceStream.end();
                console.log('✅ Voice-Stream beendet');
            } catch (e) {
                console.log('⚠️ Fehler beim Beenden des Voice-Streams:', e.message);
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