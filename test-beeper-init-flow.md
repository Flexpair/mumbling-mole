# Test: Beeper-Initialisierung bei erster Mikrofon-Berechtigung

## Problem
Der Test-Ton-Button erscheint nicht, wenn:
- Die URL zum ersten Mal auf einem Gerät aufgerufen wird
- Die Mikrofon-Berechtigung noch eingeholt werden muss
- Der Audio-Test-Modus aktiviert ist

Das Stimmecho funktioniert in diesem Fall, aber der Test-Ton-Button bleibt unsichtbar.

## Ursache
1. `_performConnect()` ruft `initVoice()` auf
2. `getUserMedia()` fordert Mikrofon-Berechtigung an (asynchron)
3. User gewährt Berechtigung
4. `getUserMedia` callback setzt `window._audioMixer`
5. `_initializePersistentBeeper()` wurde vorher aufgerufen, aber gab sofort zurück weil Mixer noch nicht existierte
6. `beeperReady()` blieb false → Button ist nicht sichtbar

## Lösung (einfach!)
`_initializePersistentBeeper()` wartet jetzt automatisch auf den Audio-Mixer (bis zu 5 Sekunden).
Keine zusätzlichen Aufrufe oder komplexe Logik nötig - die Funktion selbst ist robust.

### Code-Änderung
In `app/index.js` - `_initializePersistentBeeper()` Funktion:

```javascript
this._initializePersistentBeeper = async () => {
  if (this._persistentBeeper) return; // Already initialized
  
  try {
    // MIXER-WAIT: Wait for audio mixer to become available (handles delayed getUserMedia)
    const mixerAvailable = await waitForAudioMixer(5000, 50);
    
    if (!mixerAvailable) {
      this.beeperReady(false);
      return;
    }
    
    const mixer = window._audioMixer;
    // ... rest of initialization
  }
}
```

**Das war's!** Eine zentrale Änderung statt Code an vielen Stellen.

## Test-Szenarien

### Szenario 1: Erste Nutzung (Mikrofon-Berechtigung erforderlich)
1. Browser-Cache/Cookies löschen oder Inkognito-Modus verwenden
2. URL aufrufen
3. Audio-Test-Toggle aktivieren
4. "Connect" klicken
5. Browser fordert Mikrofon-Berechtigung an
6. Berechtigung gewähren
7. **Erwartung**: Test-Ton-Button erscheint automatisch (max. 5 Sekunden)
8. Test-Ton-Button klicken → Ton wird abgespielt

### Szenario 2: Wiederholte Nutzung (Berechtigung bereits erteilt)
1. URL aufrufen (Berechtigung bereits gespeichert)
2. Audio-Test-Toggle aktivieren
3. "Connect" klicken
4. **Erwartung**: Test-Ton-Button erscheint sofort
5. Test-Ton-Button klicken → Ton wird abgespielt

### Szenario 3: Loopback-Test über Test-Button
1. Bereits verbunden (normale Verbindung)
2. "Test" Button klicken
3. **Erwartung**: Wechselt zu Loopback-Modus, Test-Ton-Button erscheint
4. Stimmecho funktioniert
5. Test-Ton funktioniert

## Debugging
Browser-Console-Logs bei erfolgreicher Initialisierung:

```
[BEEP] Waiting for audio mixer...
[BEEP] Persistent beeper initialized and ready
```

Falls Timeout:
```
[BEEP] Mixer not ready after timeout
```
→ Problem mit AudioWorklet-Initialisierung oder getUserMedia

## Betroffene Dateien
- `app/index.js`: `_initializePersistentBeeper()` wartet jetzt automatisch auf Mixer

## Vereinfachungen
- Alle `waitForAudioMixer()` Aufrufe vor `_initializePersistentBeeper()` entfernt
- Kein redundanter Code mehr an mehreren Stellen
- Eine zentrale, robuste Implementierung
