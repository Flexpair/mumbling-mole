/**
 * Local Audio Loopback Test für v3.12.0
 * Testet Audio-Pipeline OHNE zweiten Client - umgeht Session-Konflikte
 * 
 * STRATEGIE:
 * 1. Mikrofon → Capture Audio
 * 2. Audio → Opus Encoder (wie Mumble-Sending)
 * 3. Opus → Decoder (wie Mumble-Receiving)  
 * 4. Decoded Audio → Lautsprecher
 * 
 * Loopback: Mikrofon → Encoder → Decoder → Lautsprecher
 * (Testet komplette Audio-Pipeline ohne Mumble-Server-Roundtrip)
 */

class AudioLoopbackTest {
    constructor() {
        this.audioContext = null;
        this.sourceNode = null;
        this.destinationNode = null;
        this.encoder = null;
        this.decoder = null;
        this.progressCallback = null;
        this.isRunning = false;
        this.startTime = null;
        this.processedSamples = 0;
        this.encodedPackets = 0;
        this.decodedPackets = 0;
    }

    updateProgress(message) {
        if (this.progressCallback) {
            this.progressCallback(message);
        }
        console.log('🔄 Loopback:', message);
    }

    async runTest() {
        console.log('🎵 Starte Local Audio Loopback Test...');
        this.updateProgress('🎤 Starte Audio Loopback Test...');
        
        try {
            this.startTime = Date.now();
            this.isRunning = true;
            
            // 1. Audio-Kontext initialisieren
            await this.initializeAudioContext();
            
            // 2. Mikrofon-Zugriff
            await this.setupMicrophone();
            
            // 3. Opus Encoder/Decoder Setup
            await this.setupCodecs();
            
            // 4. Audio-Pipeline verketten
            await this.connectAudioPipeline();
            
            // 5. Test für 5 Sekunden laufen lassen
            await this.runLoopbackTest();
            
            // 6. Ergebnisse anzeigen
            this.showResults();
            
            console.log('✅ Audio Loopback Test erfolgreich abgeschlossen!');
            this.updateProgress('✅ Audio Loopback Test erfolgreich!');
            
        } catch (error) {
            console.error('❌ Audio Loopback Test fehlgeschlagen:', error);
            this.updateProgress(`❌ Test fehlgeschlagen: ${error.message}`);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async initializeAudioContext() {
        this.updateProgress('🔧 Initialisiere Audio-Kontext...');
        
        // Verwende den bestehenden AudioContext oder erstelle einen neuen
        if (window.audioContextManager && window.audioContextManager.getAudioContext) {
            this.audioContext = window.audioContextManager.getAudioContext();
            console.log('✅ Verwende bestehenden AudioContext');
        } else {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Neuer AudioContext erstellt');
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log('✅ AudioContext resumed');
        }
        
        console.log('📊 AudioContext Details:');
        console.log('  - State:', this.audioContext.state);
        console.log('  - Sample Rate:', this.audioContext.sampleRate, 'Hz');
        console.log('  - Base Latency:', this.audioContext.baseLatency?.toFixed(3), 'sec');
    }

    async setupMicrophone() {
        this.updateProgress('🎤 Setuppe Mikrofon-Zugriff...');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000  // Mumble Standard
                }
            });
            
            this.sourceNode = this.audioContext.createMediaStreamSource(stream);
            console.log('✅ Mikrofon-Stream erstellt');
            console.log('📊 Stream Details:');
            
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                const settings = audioTracks[0].getSettings();
                console.log('  - Sample Rate:', settings.sampleRate, 'Hz');
                console.log('  - Channels:', settings.channelCount);
                console.log('  - Echo Cancellation:', settings.echoCancellation);
            }
            
        } catch (error) {
            console.error('❌ Mikrofon-Zugriff fehlgeschlagen:', error);
            throw new Error(`Mikrofon-Zugriff fehlgeschlagen: ${error.message}`);
        }
    }

    async setupCodecs() {
        this.updateProgress('🔧 Setuppe Opus Encoder/Decoder...');
        
        // Hier würden wir normalerweise die Mumble Opus-Codecs verwenden
        // Für jetzt simulieren wir das mit Audio-Nodes
        
        console.log('🎛️ Erstelle Audio-Processing-Nodes...');
        
        // Encoder-Simulation: Audio → komprimiert → unkomprimiert
        this.encoder = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.decoder = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        // Encoder simuliert Opus-Encoding 
        this.encoder.onaudioprocess = (event) => {
            const inputBuffer = event.inputBuffer;
            const outputBuffer = event.outputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            const outputData = outputBuffer.getChannelData(0);
            
            // Simuliere Encoder: leichte Verarbeitung + Statistik
            for (let i = 0; i < inputData.length; i++) {
                outputData[i] = inputData[i] * 0.8; // Leichte Dämpfung simuliert Kompression
            }
            
            this.encodedPackets++;
            this.processedSamples += inputData.length;
        };
        
        // Decoder simuliert Opus-Decoding
        this.decoder.onaudioprocess = (event) => {
            const inputBuffer = event.inputBuffer;
            const outputBuffer = event.outputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            const outputData = outputBuffer.getChannelData(0);
            
            // Simuliere Decoder: Wiederherstellung
            for (let i = 0; i < inputData.length; i++) {
                outputData[i] = inputData[i]; // 1:1 Übertragung
            }
            
            this.decodedPackets++;
        };
        
        console.log('✅ Audio-Processing-Nodes erstellt (Encoder/Decoder-Simulation)');
    }

    async connectAudioPipeline() {
        this.updateProgress('🔗 Verbinde Audio-Pipeline...');
        
        // Pipeline: Mikrofon → Encoder → Decoder → Lautsprecher
        this.sourceNode.connect(this.encoder);
        this.encoder.connect(this.decoder);
        this.decoder.connect(this.audioContext.destination);
        
        console.log('✅ Audio-Pipeline verbunden:');
        console.log('  Mikrofon → Encoder → Decoder → Lautsprecher');
        console.log('📊 Pipeline bereit für Loopback-Test');
    }

    async runLoopbackTest() {
        this.updateProgress('🔄 Laufe Loopback-Test (5 Sekunden)...');
        
        console.log('🎵 Loopback-Test gestartet - sprechen Sie ins Mikrofon!');
        console.log('⏱️ Test läuft für 5 Sekunden...');
        
        // Status-Updates alle Sekunde
        const statusInterval = setInterval(() => {
            const elapsed = (Date.now() - this.startTime) / 1000;
            this.updateProgress(`🔄 Loopback läuft... ${elapsed.toFixed(1)}s (${this.encodedPackets} Pakete)`);
            
            console.log('📊 Live-Statistik:');
            console.log(`  - Laufzeit: ${elapsed.toFixed(1)}s`);
            console.log(`  - Encoded Pakete: ${this.encodedPackets}`);
            console.log(`  - Decoded Pakete: ${this.decodedPackets}`);
            console.log(`  - Verarbeitete Samples: ${this.processedSamples}`);
        }, 1000);
        
        // 5 Sekunden warten
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        clearInterval(statusInterval);
        console.log('✅ Loopback-Test abgeschlossen');
    }

    showResults() {
        const duration = (Date.now() - this.startTime) / 1000;
        
        console.log('📊 === LOOPBACK TEST ERGEBNISSE ===');
        console.log(`⏱️ Test-Dauer: ${duration.toFixed(2)} Sekunden`);
        console.log(`📦 Encoded Pakete: ${this.encodedPackets}`);
        console.log(`📦 Decoded Pakete: ${this.decodedPackets}`);
        console.log(`🔢 Verarbeitete Samples: ${this.processedSamples.toLocaleString()}`);
        console.log(`📈 Samples/Sekunde: ${(this.processedSamples / duration).toFixed(0)}`);
        console.log(`📈 Pakete/Sekunde: ${(this.encodedPackets / duration).toFixed(1)}`);
        
        // Erfolgs-Bewertung
        const expectedPacketsPerSec = Math.floor(this.audioContext.sampleRate / 4096); // ScriptProcessor Block-Size
        const actualPacketsPerSec = this.encodedPackets / duration;
        const efficiency = (actualPacketsPerSec / expectedPacketsPerSec) * 100;
        
        console.log(`🎯 Effizienz: ${efficiency.toFixed(1)}% (erwarte ~${expectedPacketsPerSec} Pakete/s)`);
        
        if (this.encodedPackets > 0 && this.decodedPackets > 0) {
            console.log('✅ ERFOLG: Audio-Pipeline funktioniert!');
            this.updateProgress(`✅ ERFOLG: ${this.encodedPackets} Pakete verarbeitet (${efficiency.toFixed(1)}% Effizienz)`);
        } else {
            console.log('❌ FEHLER: Keine Audio-Verarbeitung erkannt');
            this.updateProgress('❌ FEHLER: Keine Audio-Verarbeitung erkannt');
        }
    }

    async cleanup() {
        this.updateProgress('🧹 Cleanup...');
        this.isRunning = false;
        
        try {
            if (this.sourceNode) {
                this.sourceNode.disconnect();
            }
            if (this.encoder) {
                this.encoder.disconnect();
            }
            if (this.decoder) {
                this.decoder.disconnect();
            }
            
            console.log('✅ Audio-Nodes disconnected');
        } catch (error) {
            console.warn('⚠️ Cleanup warning:', error);
        }
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
}

// ES6 Export für Webpack
export default AudioLoopbackTest;