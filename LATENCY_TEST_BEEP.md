# Test-Ton mit Latenz-Messung (Dual-Output Beep)

## Übersicht

Der Test-Ton wurde erweitert, um **sowohl lokal als auch als Echo vom Mumble Server** abgespielt zu werden. Dadurch können Sie die Netzwerk-Latenz direkt hören.

## Wie es funktioniert

### Audio-Signalfluss

Der 440 Hz Sinus-Ton wird jetzt auf **zwei parallelen Wegen** ausgegeben:

1. **Lokaler Weg (sofort)**:
   - Oszillator → `localGain` → AudioContext.destination
   - **Kein Delay** - Sie hören den Ton sofort wenn Sie die Test-Taste drücken
   - Lautstärke: 0.3 (etwas leiser)

2. **Server-Echo-Weg (verzögert)**:
   - Oszillator → `beepGain` → `_audioMixer` → Server (Loopback target=31) → zurück zum Client
   - **Mit Netzwerk-Latenz** - Sie hören das Echo nach der Round-Trip-Zeit
   - Lautstärke: 0.4 (etwas lauter)

### Warum zwei unterschiedliche Lautstärken?

- **Lokal: 0.3** (leiser) - der sofortige "Click"
- **Echo: 0.4** (lauter) - das verzögerte Echo vom Server
- Dies hilft, beide Signale akustisch zu unterscheiden

## Was Sie hören werden

Wenn Sie den Test-Button drücken:

1. **Sofortiger Ton** - Der lokale Weg spielt ab (0ms Latenz)
2. **Echo-Ton** - Nach einigen Millisekunden hören Sie das Server-Echo
3. **Zeitdifferenz** = Ihre Round-Trip-Latenz zum Server

### Beispiel-Latenz-Szenarien:

- **LAN/lokaler Server**: ~5-20ms → kaum hörbar, minimales Echo
- **Gutes Internet**: ~20-50ms → deutliches kurzes Echo
- **Schlechte Verbindung**: >100ms → klares separates Echo

## Technische Details

### Geänderte Funktionen in `app/index.js`:

#### 1. `_initializePersistentBeeper()`
```javascript
// Erstellt zwei separate Gain-Nodes:
const beepGain = ac.createGain();      // Für Server-Echo
const localGain = ac.createGain();     // Für lokale Wiedergabe

// Parallele Verbindungen:
oscillator.connect(beepGain);
beepGain.connect(mixer);               // → Server

oscillator.connect(localGain);
localGain.connect(ac.destination);     // → lokale Lautsprecher
```

#### 2. `startBeep()`
```javascript
// Beide Wege gleichzeitig aktivieren:
beeper.gain.gain.linearRampToValueAtTime(0.4, currentTime + attackTime);      // Server
beeper.localGain.gain.linearRampToValueAtTime(0.3, currentTime + attackTime); // Lokal
```

#### 3. `stopBeep()`
```javascript
// Beide Wege mit Piano-Envelope ausblenden:
// - Sanfter Abfall für 300ms
// - Exponentieller Decay für 1000ms
// (Gleiche Envelope-Kurve für beide Wege)
```

## Verwendung

1. **Mit Server verbinden** (loopback mode ist empfohlen für Test)
2. **Test-Button drücken** (im Connection-Dialog oder UI)
3. **Hören Sie**:
   - Ersten Ton sofort
   - Zweiten Ton (Echo) nach der Latenz-Zeit
4. **Mentale Berechnung**: Zeit zwischen den zwei Tönen = Ihre Latenz

## Debugging

Console-Ausgaben zum Überprüfen:

```
[BEEP] Persistent beeper initialized with dual output (local + server echo) for latency testing
[BEEP] DUAL beep activated: local (immediate) + server echo (delayed) - listen for latency!
[BEEP] Dual fadeout: 0.3s gentle + 1.0s decay (local + echo)
```

## Bekannte Einschränkungen

- **Loopback-Mode-Warnung**: Der Loopback-Test testet nur den gleichen Client (siehe `app/audio/README.md`)
- **Mixer-Abhängigkeit**: Funktioniert nur wenn `window._audioMixer` verfügbar ist (nach getUserMedia)
- **Audio-Kontext**: Benötigt laufenden AudioContext (state: 'running')

## Nächste Schritte

Für noch bessere Latenz-Messungen könnten Sie:
- VU-Meter für beide Signale anzeigen
- Numerische Latenz-Anzeige (benötigt Timestamp-Tracking)
- Visuelle Wellenform-Anzeige
- Ping-basierte Netzwerk-Latenz parallel anzeigen

---

**Autor**: GitHub Copilot  
**Datum**: 2025-10-14  
**Dateien geändert**: `app/index.js`  
