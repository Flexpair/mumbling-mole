# Fix: Audio Playback Race Condition für andere User

## Problem-Beschreibung

**Symptom:** Bei normaler Verbindung (Connect-Button) konnten andere sprechende User nicht gehört werden, obwohl:
- Voice-Daten erfolgreich empfangen wurden ✅
- Voice-Daten erfolgreich dekodiert wurden ✅  
- Aber die dekodierten Audio-Daten nie zum AudioContext-Destination weitergeleitet wurden ❌

**Im Loopback-Modus funktionierte es korrekt.**

## Root Cause Analysis

### Log-Vergleich

**Loopback (funktioniert):**
```
[DEBUG-WORKER] Voice stream started for user, voiceId: 1
[DEBUG-VOICE] Received voice stream from user undefined
[DEBUG-VOICE] BufferQueueNode created
[DEBUG-VOICE] Connected to destination
[DEBUG-VOICE] Received audio data packet - target: normal buffer size: 3840
[DEBUG-VOICE] Writing to userNode
[DEBUG-VOICE] Write completed
```

**Normale Verbindung (funktioniert NICHT):**
```
[DEBUG-DECODER] Transform called - codec: Opus frame size: 720
[DEBUG-DECODER] Decoded audio - buffer size: 11520
[DEBUG-WORKER] Voice data received - target: normal pcm size: 11520
[DEBUG-WORKER] Posted message to UI thread
```
**Fehlt:** Alle `[DEBUG-VOICE]` Logs → Voice-Stream-Handler wurde nie erstellt!

### Race Condition

1. **Normaler Ablauf (sollte so sein):**
   - Server sendet `UserState` für anderen User
   - Worker empfängt `newUser` Event
   - Worker ruft `setupUser()` auf → registriert `voice` Event-Handler im Worker
   - Worker sendet `newUser` Message an UI-Thread
   - UI-Thread ruft `_newUser()` auf → registriert `.on('voice')` Handler im UI
   - User spricht → `voice` Event im Worker → Message an UI → UI-Handler erstellt BufferQueueNode

2. **Tatsächlicher Ablauf (Race Condition):**
   - Server sendet `UserState` für anderen User
   - Worker empfängt `newUser` Event
   - **User spricht SOFORT (bevor Worker-Message verarbeitet wurde)**
   - Worker sendet `voice` Event Message an UI-Thread mit `userId`
   - UI-Thread empfängt `voice` Message → ruft `client._user(userId)` auf
   - `_user()` erstellt **implizit** einen neuen User (ohne `_newUser()` aufzurufen!)
   - Voice-Stream wird dispatched, **ABER** es gibt keinen `.on('voice')` Handler!
   - Später: `newUser` Message kommt an, aber User existiert bereits

### Code-Stellen

**worker-client.js (alt):**
```javascript
_user(id) {
  let user = this._users[id];
  if (!user) {
    user = new WorkerBasedMumbleUser(this._connector, this, id);
    this._users[id] = user;  // User ohne UI-Initialisierung!
  }
  return user;
}
```

**index.js:**
```javascript
client.on('newUser', (user) => this._newUser(user));

this._newUser = (user) => {
  var ui = (user.__ui = { /* ... */ });
  // ...
  user.on('voice', (stream) => {  // Dieser Handler fehlt bei Race Condition!
    var userNode = new BufferQueueNode({ audioContext: this.audioContext });
    userNode.connect(this.audioContext.destination);
    stream.on('data', (data) => {
      userNode.write(data.buffer);
    });
  });
};
```

## Lösung

### 1. Auto-emit von newUser/newChannel Events (worker-client.js)

```javascript
_user(id) {
  let user = this._users[id];
  if (!user) {
    user = new WorkerBasedMumbleUser(this._connector, this, id);
    this._users[id] = user;
    // Emit newUser event to ensure UI handlers are registered
    // This handles race conditions where voice events arrive before
    // the newUser event from the worker
    this.emit('newUser', user);
  }
  return user;
}

_channel(id) {
  let channel = this._channels[id];
  if (!channel) {
    channel = new WorkerBasedMumbleChannel(this._connector, this, id);
    this._channels[id] = channel;
    // Emit newChannel event to ensure UI handlers are registered
    this.emit('newChannel', channel);
  }
  return channel;
}
```

### 2. Idempotente UI-Initialisierung (index.js)

```javascript
this._newUser = (user) => {
  // Skip if UI already initialized (prevents duplicate event handlers)
  if (user.__ui) {
    return;
  }
  // ... restlicher Code
};

this._newChannel = (channel) => {
  // Skip if UI already initialized (prevents duplicate event handlers)
  if (channel.__ui) {
    return;
  }
  // ... restlicher Code
};
```

## Vorteile dieser Lösung

1. **Garantierte UI-Initialisierung:** Jeder User/Channel bekommt immer UI-Handler, egal ob durch explizites `newUser` Event oder implizite `_user()` Erstellung
2. **Idempotenz:** Mehrfache Aufrufe von `_newUser()`/`_newChannel()` sind sicher
3. **Keine Breaking Changes:** Bestehende Funktionalität bleibt erhalten
4. **Loopback weiterhin funktionsfähig:** User-Migration funktioniert wie zuvor

## Test-Plan

### Manueller Test

1. **Normale Verbindung (Connect-Button):**
   - Mit zwei Clients auf demselben Server verbinden
   - Client A spricht
   - **Erwartung:** Client B hört Client A
   - **Console-Check:** `[DEBUG-VOICE]` Logs sollten erscheinen

2. **Loopback-Test:**
   - Mit "Test" Button verbinden
   - Sprechen
   - **Erwartung:** Sich selbst hören (wie zuvor)
   - **Console-Check:** Alle Logs wie in `loopback.log`

3. **Race Condition Test:**
   - Client A bereits auf Server verbunden und spricht kontinuierlich
   - Client B verbindet sich während Client A spricht
   - **Erwartung:** Client B hört Client A sofort nach Verbindung

### Automatisierte Tests

```bash
# System-Tests (schnell)
npm run test:audio:system

# Full E2E Tests
npm run test:e2e

# Audio Roundtrip Tests
npm run test:audio
```

## Verifizierung

Nach dem Fix sollte in der Browser-Console beim Empfang von Audio von anderen Usern erscheinen:

```
[DEBUG-VOICE] Received voice stream from user <username>
[DEBUG-VOICE] AudioContext state: running
[DEBUG-VOICE] AudioContext sampleRate: 48000
[DEBUG-VOICE] BufferQueueNode created
[DEBUG-VOICE] Connected to destination
[DEBUG-VOICE] Received audio data packet - target: normal buffer size: 3840
[DEBUG-VOICE] Writing to userNode
[DEBUG-VOICE] Write completed
```

## Geänderte Dateien

- `app/worker-client.js`: Auto-emit newUser/newChannel bei impliziter Erstellung
- `app/index.js`: Idempotenz-Checks in _newUser() und _newChannel()

## Related Issues

- Loopback funktionierte, weil User-Migration in `_setProp()` Event-Handler korrekt überträgt
- Worker initialisiert User in `initializeClientState()`, aber UI-Thread kann User früher brauchen
