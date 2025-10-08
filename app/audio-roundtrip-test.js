/**
 * Echter Audio Roundtrip Test für v3.12.0
 * Testet den kompletten Audio-Workflow mit echtem Mumble-Server
 * 
 * STRATEGIE:
 * 1. Hauptclient (bereits verbunden) sendet Audio
 * 2. Testclient (neuer Bot) empfängt das Audio  
 * 3. Testclient sendet Audio zurück
 * 4. Hauptclient empfängt Audio vom Testclient
 * 
 * Echter Roundtrip: Client A → Server → Client B → Server → Client A
 */

class AudioRoundtripTest {
    constructor() {
        this.mainClient = null;
        this.testClient = null;
        this.receivedPackets = 0;
        this.sentPackets = 0;
        this.testClientReceivedPackets = 0;
        this.testClientSentPackets = 0;
        this.testStartTime = null;
        this.mainClientVoiceListener = null;
        this.testClientVoiceListener = null;
        this.testClientReady = false;
        this.roundtripCompleted = false;
        this.progressCallback = null; // Für UI-Updates
    }

    updateProgress(message) {
        if (this.progressCallback) {
            this.progressCallback(message);
        }
    }

    async runTest(mumbleClient) {
        if (!mumbleClient) {
            throw new Error('Kein Mumble-Client verfügbar');
        }

        console.log('🎵 Starte ECHTEN Audio-Roundtrip-Test (zwei Clients)...');
        this.mainClient = mumbleClient;
        this.receivedPackets = 0;
        this.sentPackets = 0;
        this.testClientReceivedPackets = 0;
        this.testClientSentPackets = 0;
        this.testClientReady = false;
        this.roundtripCompleted = false;
        this.testStartTime = Date.now();

        try {
            // 1. Erstelle zweiten Test-Client (Bot)
            this.updateProgress('🤖 Erstelle Test-Bot...');
            await this.createTestClient();

            // 2. Richte Voice-Event-Listener ein
            this.updateProgress('🎧 Richte Audio-Listener ein...');
            this.setupVoiceListeners();

            // 3. Warte bis Test-Client bereit ist
            this.updateProgress('⏳ Warte auf Test-Bot-Bereitschaft...');
            await this.waitForTestClientReady();

            // 4. Starte Roundtrip-Sequenz
            this.updateProgress('🔄 Starte Audio-Roundtrip...');
            await this.performRoundtripTest();

            // 5. Warte auf Ergebnisse
            this.updateProgress('📊 Analysiere Ergebnisse...');
            return await this.waitForResults();

        } catch (error) {
            console.error('❌ Audio-Roundtrip-Test fehlgeschlagen:', error);
            throw error;
        } finally {
            this.cleanup();
        }
    }

    async createTestClient() {
        console.log('🤖 Erstelle Test-Client (Audio-Bot)...');
        
        try {
            // Hole Verbindungsdaten vom Hauptclient
            const serverInfo = this.getServerInfo();
            console.log('📡 Verbinde Audio-Bot mit Server:', serverInfo);
            
            // Timeout für die gesamte Client-Erstellung
            const createClientWithTimeout = async () => {
                // Importiere Mumble-WebSocket-Client
                const mumbleConnect = (await import('./mumble-websocket.js')).default;
                
                console.log('🔗 Starte WebSocket-Verbindung...');
                this.updateProgress('🔗 Verbinde WebSocket...');
                
                // Erstelle neue Verbindung als Test-Bot
                const testClient = await mumbleConnect(serverInfo.address, {
                    username: 'AudioTestBot_' + Date.now(),
                    password: serverInfo.password || '',
                    codecs: serverInfo.codecs || ['Opus']
                });
                
                console.log('✅ WebSocket-Verbindung hergestellt');
                this.updateProgress('✅ WebSocket verbunden, warte auf Mumble-Initialisierung...');
                
                // Warte auf vollständige Mumble-Initialisierung mit Timeout
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout beim Warten auf Mumble-Client-Initialisierung'));
                    }, 10000); // 10 Sekunden Timeout
                    
                    if (testClient.root) {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        const onReady = () => {
                            clearTimeout(timeout);
                            testClient.off('ready', onReady);
                            testClient.off('error', onError);
                            resolve();
                        };
                        
                        const onError = (error) => {
                            clearTimeout(timeout);
                            testClient.off('ready', onReady);
                            testClient.off('error', onError);
                            reject(error);
                        };
                        
                        testClient.on('ready', onReady);
                        testClient.on('error', onError);
                    }
                });
                
                return testClient;
            };
            
            // Führe Client-Erstellung mit globalem Timeout aus
            this.testClient = await Promise.race([
                createClientWithTimeout(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Globaler Timeout bei Test-Client-Erstellung')), 15000);
                })
            ]);
            
            this.testClientReady = true;
            console.log('✅ Test-Client ist vollständig bereit');
            
        } catch (error) {
            console.error('❌ Fehler beim Erstellen des Test-Clients:', error);
            throw new Error(`Test-Client-Erstellung fehlgeschlagen: ${error.message}`);
        }
    }

    getServerInfo() {
        // Extrahiere Server-Info für WebSocket-Verbindung über websockify
        // websockify läuft auf demselben Host/Port wie die Web-App
        // und tunnelt WebSocket-Verbindungen zum echten Mumble-Server
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host; // Host:Port von websockify
        
        return {
            address: `${protocol}//${host}/`, // websockify root path
            password: '', // Normalerweise kein Passwort nötig
            codecs: ['Opus']
        };
    }

    setupVoiceListeners() {
        console.log('🎧 Richte Voice-Event-Listener für beide Clients ein...');
        
        // Listener für Hauptclient (empfängt Audio vom Test-Client)
        this.mainClientVoiceListener = (voiceStream) => {
            console.log('📥 Hauptclient empfängt Voice-Stream');
            
            voiceStream.on('data', (data) => {
                this.receivedPackets++;
                
                if (this.receivedPackets === 1) {
                    const elapsed = Date.now() - this.testStartTime;
                    console.log(`📥 Hauptclient: Erstes Audio-Paket empfangen nach ${elapsed}ms`);
                    this.roundtripCompleted = true;
                }
                
                if (this.receivedPackets % 10 === 0) {
                    console.log(`📊 Hauptclient: ${this.receivedPackets} Audio-Pakete empfangen`);
                }
            });
        };
        
        // Listener für Test-Client (empfängt Audio vom Hauptclient und sendet zurück)
        this.testClientVoiceListener = (voiceStream) => {
            console.log('📥 Test-Client empfängt Voice-Stream');
            
            voiceStream.on('data', (data) => {
                this.testClientReceivedPackets++;
                
                if (this.testClientReceivedPackets === 1) {
                    console.log('📥 Test-Client: Erstes Audio-Paket empfangen - starte Echo');
                    // Starte Echo-Antwort
                    this.startTestClientEcho();
                }
                
                if (this.testClientReceivedPackets % 20 === 0) {
                    console.log(`📊 Test-Client: ${this.testClientReceivedPackets} Audio-Pakete empfangen`);
                }
            });
        };
        
        // Registriere Listener
        if (this.mainClient && typeof this.mainClient.on === 'function') {
            this.mainClient.on('voice', this.mainClientVoiceListener);
            console.log('✅ Voice-Listener für Hauptclient registriert');
        }
        
        if (this.testClient && typeof this.testClient.on === 'function') {
            this.testClient.on('voice', this.testClientVoiceListener);
            console.log('✅ Voice-Listener für Test-Client registriert');
        }
    }

    async waitForTestClientReady() {
        console.log('⏳ Warte auf Test-Client-Bereitschaft...');
        
        let attempts = 0;
        while (!this.testClientReady && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.testClientReady) {
            throw new Error('Test-Client wurde nicht rechtzeitig bereit');
        }
        
        console.log('✅ Test-Client ist bereit für Roundtrip-Test');
    }

    async performRoundtripTest() {
        console.log('🔄 Starte Roundtrip-Sequenz...');
        
        // Phase 1: Hauptclient sendet Audio an Test-Client
        this.updateProgress('📤 Sende Audio vom Hauptclient...');
        await this.sendAudioFromMainClient();
        
        // Phase 2: Warte auf Test-Client-Echo (wird automatisch gestartet)
        this.updateProgress('📥 Warte auf Echo vom Test-Bot...');
        await this.waitForEcho();
    }

    async sendAudioFromMainClient() {
        console.log('📤 Hauptclient sendet Audio...');
        
        return new Promise((resolve, reject) => {
            try {
                const voiceStream = this.mainClient.createVoiceStream(960);
                
                const sendAudioData = () => {
                    if (this.sentPackets < 50) { // 1 Sekunde Audio
                        const audioBuffer = new Float32Array(960);
                        // 440Hz Testton
                        for (let i = 0; i < 960; i++) {
                            audioBuffer[i] = Math.sin(2 * Math.PI * 440 * (this.sentPackets * 960 + i) / 48000) * 0.2;
                        }
                        
                        voiceStream.write(Buffer.from(audioBuffer.buffer));
                        this.sentPackets++;
                        
                        if (this.sentPackets === 1) {
                            console.log('📤 Hauptclient: Erstes Audio-Paket gesendet');
                        }
                        
                        setTimeout(sendAudioData, 20);
                    } else {
                        console.log(`📤 Hauptclient: Audio-Sendung beendet (${this.sentPackets} Pakete)`);
                        voiceStream.end();
                        resolve();
                    }
                };
                
                sendAudioData();
                
            } catch (error) {
                reject(error);
            }
        });
    }

    startTestClientEcho() {
        console.log('🔊 Test-Client startet Echo-Antwort...');
        
        try {
            const voiceStream = this.testClient.createVoiceStream(960);
            
            const sendEcho = () => {
                if (this.testClientSentPackets < 50) { // 1 Sekunde Echo
                    const audioBuffer = new Float32Array(960);
                    // 880Hz Echo-Ton (eine Oktave höher)
                    for (let i = 0; i < 960; i++) {
                        audioBuffer[i] = Math.sin(2 * Math.PI * 880 * (this.testClientSentPackets * 960 + i) / 48000) * 0.2;
                    }
                    
                    voiceStream.write(Buffer.from(audioBuffer.buffer));
                    this.testClientSentPackets++;
                    
                    if (this.testClientSentPackets === 1) {
                        console.log('📤 Test-Client: Echo-Sendung gestartet');
                    }
                    
                    setTimeout(sendEcho, 20);
                } else {
                    console.log(`📤 Test-Client: Echo beendet (${this.testClientSentPackets} Pakete)`);
                    voiceStream.end();
                }
            };
            
            sendEcho();
            
        } catch (error) {
            console.error('❌ Test-Client Echo-Fehler:', error);
        }
    }

    async waitForEcho() {
        console.log('⏳ Warte auf Echo-Empfang...');
        
        let attempts = 0;
        while (!this.roundtripCompleted && attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.log('✅ Echo-Phase abgeschlossen');
    }

    async waitForResults() {
        console.log('⏳ Analysiere Roundtrip-Ergebnisse...');
        
        // Warte weitere 3 Sekunden auf verspätete Pakete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const results = {
            sentPackets: this.sentPackets,
            receivedPackets: this.receivedPackets,
            testClientReceivedPackets: this.testClientReceivedPackets,
            testClientSentPackets: this.testClientSentPackets,
            roundtripCompleted: this.roundtripCompleted,
            testClientCreated: this.testClient !== null,
            success: false,
            roundtripTime: Date.now() - this.testStartTime
        };
        
        // Erfolgskriterien für echten Roundtrip:
        // 1. Test-Client wurde erstellt
        // 2. Hauptclient hat Audio gesendet
        // 3. Test-Client hat Audio empfangen
        // 4. Test-Client hat Echo gesendet  
        // 5. Hauptclient hat Echo empfangen (Roundtrip komplett)
        
        if (results.testClientCreated && 
            results.sentPackets > 40 && 
            results.testClientReceivedPackets > 0 &&
            results.testClientSentPackets > 0 &&
            results.receivedPackets > 0 &&
            results.roundtripCompleted) {
            
            results.success = true;
            console.log('🎉 ECHTER Audio-Roundtrip erfolgreich!');
            console.log(`   📤 Hauptclient gesendet: ${results.sentPackets} Pakete`);
            console.log(`   📥 Test-Client empfangen: ${results.testClientReceivedPackets} Pakete`);
            console.log(`   📤 Test-Client Echo: ${results.testClientSentPackets} Pakete`);
            console.log(`   📥 Hauptclient Echo empfangen: ${results.receivedPackets} Pakete`);
            console.log(`   ⏱️ Roundtrip-Zeit: ${results.roundtripTime}ms`);
            
        } else {
            console.log('❌ Audio-Roundtrip fehlgeschlagen:');
            if (!results.testClientCreated) {
                console.log('   - Test-Client konnte nicht erstellt werden');
            }
            if (results.sentPackets <= 40) {
                console.log(`   - Hauptclient sendete zu wenig: ${results.sentPackets} Pakete`);
            }
            if (results.testClientReceivedPackets === 0) {
                console.log('   - Test-Client empfing kein Audio');
            }
            if (results.testClientSentPackets === 0) {
                console.log('   - Test-Client sendete kein Echo');
            }
            if (results.receivedPackets === 0) {
                console.log('   - Hauptclient empfing kein Echo');
            }
            if (!results.roundtripCompleted) {
                console.log('   - Roundtrip wurde nicht abgeschlossen');
            }
        }
        
        console.log('📊 Detaillierte Roundtrip-Ergebnisse:', results);
        return results;
    }

    cleanup() {
        console.log('🧹 Cleanup wird durchgeführt...');
        
        // Entferne Event-Listener vom Hauptclient
        if (this.mainClient && this.mainClientVoiceListener && typeof this.mainClient.off === 'function') {
            this.mainClient.off('voice', this.mainClientVoiceListener);
            console.log('✅ Voice-Listener vom Hauptclient entfernt');
        }
        
        // Entferne Event-Listener vom Test-Client
        if (this.testClient && this.testClientVoiceListener && typeof this.testClient.off === 'function') {
            this.testClient.off('voice', this.testClientVoiceListener);
            console.log('✅ Voice-Listener vom Test-Client entfernt');
        }
        
        // Trenne Test-Client
        if (this.testClient && typeof this.testClient.disconnect === 'function') {
            try {
                this.testClient.disconnect();
                console.log('✅ Test-Client getrennt');
            } catch (e) {
                console.log('⚠️ Fehler beim Trennen des Test-Clients:', e.message);
            }
        }
        
        this.mainClient = null;
        this.testClient = null;
        this.mainClientVoiceListener = null;
        this.testClientVoiceListener = null;
    }
}

// Globale Instanz
window.audioRoundtripTest = new AudioRoundtripTest();

// Convenience-Funktion
window.testAudioRoundtrip = (mumbleClient) => {
    return window.audioRoundtripTest.runTest(mumbleClient);
};

export default AudioRoundtripTest;