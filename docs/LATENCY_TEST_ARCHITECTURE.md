# Test-Ton Latenz-Messung - Architektur

## Audio-Signal-Fluss-Diagramm

```
                    ┌─────────────────────┐
                    │  440 Hz Oscillator  │
                    │   (permanent an)    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                │                             │
        ┌───────▼──────┐              ┌──────▼──────┐
        │  beepGain    │              │ localGain   │
        │  (Vol: 0.4)  │              │ (Vol: 0.3)  │
        └───────┬──────┘              └──────┬──────┘
                │                             │
        ┌───────▼──────┐                      │
        │ _audioMixer  │                      │
        │  (vom mic)   │                      │
        └───────┬──────┘                      │
                │                             │
        ┌───────▼──────────┐                  │
        │ AudioWorklet     │                  │
        │ (encoder)        │                  │
        └───────┬──────────┘                  │
                │                             │
        ┌───────▼──────────┐                  │
        │ Voice Stream     │                  │
        │ (target=31)      │                  │
        └───────┬──────────┘                  │
                │                             │
        ┌───────▼──────────┐                  │
        │ WebSocket →      │                  │
        │ Mumble Server    │                  │
        └───────┬──────────┘                  │
                │                             │
                │ ◄─── LOOPBACK (target=31)   │
                │                             │
        ┌───────▼──────────┐                  │
        │ Voice Event      │                  │
        │ 'data'           │                  │
        └───────┬──────────┘                  │
                │                             │
        ┌───────▼──────────┐                  │
        │ BufferQueueNode  │                  │
        └───────┬──────────┘                  │
                │                             │
                │          ┌──────────────────┘
                │          │
         ┌──────▼──────────▼──────┐
         │  AudioContext          │
         │  .destination          │
         │  (Lautsprecher)        │
         └────────────────────────┘
                   │
                   ▼
            ┌────────────┐
            │  🔊 Output │
            └────────────┘

     Pfad A (Server):        Pfad B (Lokal):
     ~~~~~~~~~~~~~~~~        ~~~~~~~~~~~~~~~
     • Start: t=0            • Start: t=0
     • Encoding: ~5ms        • Direkt
     • Network Up: ~X ms     • Latenz: 0ms
     • Server: ~2ms          
     • Network Down: ~X ms   
     • Decoding: ~5ms        
     • Total: ~(10+2X) ms    
```

## Zeitlicher Ablauf

```
Zeit →

t=0ms     ┌─────────────────────────────────────┐
          │ User drückt Test-Button             │
          └─────────────────────────────────────┘
             │
             ├─► startBeep() aufgerufen
             │
             ├─► beepGain.gain: 0 → 0.4 (5ms ramp)
             └─► localGain.gain: 0 → 0.3 (5ms ramp)

t=0-5ms   ┌─────────────────────────────────────┐
          │ Attack Phase (beide Wege)           │
          │ • Lokaler Ton wird lauter           │
          │ • Signal zum Server startet         │
          └─────────────────────────────────────┘
                                  │
t=5ms     ┌─────────────────────────────────────┐
          │ 🔊 LOKALER TON HÖRBAR               │
          │ (Lautstärke: 0.3)                   │
          └─────────────────────────────────────┘

t=5-X ms  ┌─────────────────────────────────────┐
          │ Server Round-Trip läuft...          │
          │ • Encoding                          │
          │ • Network Upload                    │
          │ • Server Loopback                   │
          │ • Network Download                  │
          │ • Decoding                          │
          └─────────────────────────────────────┘

t=X ms    ┌─────────────────────────────────────┐
          │ 🔊 SERVER-ECHO HÖRBAR               │
          │ (Lautstärke: 0.4)                   │
          │                                     │
          │ ▲                                   │
          │ │                                   │
          │ └─ LATENZ = (X - 5) ms              │
          └─────────────────────────────────────┘

t=X+      ┌─────────────────────────────────────┐
          │ Beide Töne zusammen hörbar          │
          │ • Lokal: weiter bei 0.3             │
          │ • Echo: weiter bei 0.4              │
          └─────────────────────────────────────┘

User      ┌─────────────────────────────────────┐
stoppt    │ User lässt Test-Button los          │
          └─────────────────────────────────────┘
             │
             └─► stopBeep() aufgerufen
             
t=stop    ┌─────────────────────────────────────┐
          │ Piano Envelope (beide Wege):        │
          │ • 300ms: sanfter Abfall             │
          │ • 1000ms: exponentieller Decay      │
          └─────────────────────────────────────┘
```

## Beispiel-Szenarien

### Szenario 1: LAN (sehr niedrige Latenz)
```
t=0ms:   Lokaler Ton startet 🔊
t=5ms:   Lokaler Ton voll hörbar
t=15ms:  Server-Echo kommt an 🔊🔊
         → Latenz: ~10ms
         → Wahrnehmung: Fast gleichzeitig, leichte "Verstärkung"
```

### Szenario 2: Gute Internet-Verbindung
```
t=0ms:   Lokaler Ton startet 🔊
t=5ms:   Lokaler Ton voll hörbar
t=45ms:  Server-Echo kommt an 🔊 ... 🔊
         → Latenz: ~40ms
         → Wahrnehmung: Kurzes, deutliches Echo
```

### Szenario 3: Schlechte Verbindung
```
t=0ms:   Lokaler Ton startet 🔊
t=5ms:   Lokaler Ton voll hörbar
t=155ms: Server-Echo kommt an 🔊 ......... 🔊
         → Latenz: ~150ms
         → Wahrnehmung: Separater zweiter Ton, wie ein Echo
```

## Technische Parameter

### Lautstärke-Kalibrierung
- **Lokal (0.3)**: Leiser, damit das Echo deutlicher ist
- **Echo (0.4)**: Lauter, repräsentiert den Haupt-Signal-Weg

### Attack/Release
- **Attack**: 5ms (linearRampToValueAtTime)
  - Vermeidet Audio-Clicks
  - Schnell genug für präzises Timing
  
- **Release**: Zweiphasig
  - Phase 1: 300ms linear (0.4 → 0.25 bzw. 0.3 → 0.18)
  - Phase 2: 1000ms exponentiell (→ 0.001)
  - Klingt natürlich wie ein Piano

### Audio-Format
- **Frequenz**: 440 Hz (A4, Kammerton)
- **Wellenform**: Sinus (rein, keine Obertöne)
- **Sample Rate**: 48 kHz (Mumble-Standard)
- **Channels**: Mono

## Debugging-Tipps

### Console-Logs überwachen
```javascript
[BEEP] Persistent beeper initialized with dual output (local + server echo)...
[BEEP] DUAL beep activated: local (immediate) + server echo (delayed) - listen for latency!
[VOICE] Voice stream received for user: YourUsername
[VOICE] Audio data received, target: loopback, buffer size: ...
[BEEP] Dual fadeout: 0.3s gentle + 1.0s decay (local + echo)
```

### Web Audio Inspector (Chrome DevTools)
1. chrome://flags → Enable "Web Audio Inspector"
2. DevTools → Performance → Record
3. Test-Button drücken
4. Audio-Graphen analysieren

### Erwartete Knoten-Struktur
```
OscillatorNode (440Hz)
  ├─► GainNode (beepGain)
  │     └─► GainNode (_audioMixer)
  │           └─► AudioWorkletNode (recorder)
  │                 └─► [WebSocket Stream]
  │
  └─► GainNode (localGain)
        └─► AudioDestinationNode
```

## Fehlerbehebung

### Problem: Kein lokaler Ton
**Symptom**: Nur das Echo ist hörbar  
**Ursache**: `localGain` nicht verbunden  
**Lösung**: Prüfen ob `oscillator.connect(localGain)` existiert

### Problem: Kein Echo
**Symptom**: Nur lokaler Ton, kein zweiter Ton  
**Ursache**: Loopback nicht aktiv oder `_audioMixer` fehlt  
**Lösung**: 
- Prüfen `ui.isLoopbackMode() === true`
- Prüfen `window._audioMixer !== null`

### Problem: Beide Töne gleichzeitig
**Symptom**: Keine wahrnehmbare Latenz  
**Ursache**: Sehr schnelle Verbindung (<10ms)  
**Lösung**: Normal! LAN-Verbindungen sind so schnell

### Problem: Echo viel später als erwartet
**Symptom**: >200ms Latenz  
**Ursache**: Schlechte Netzwerkverbindung oder Server-Überlastung  
**Lösung**: Network-Probleme beheben

---

**Erstellt**: 2025-10-14  
**Version**: 1.0  
**Für**: mumbling-mole v0.5.1+  
