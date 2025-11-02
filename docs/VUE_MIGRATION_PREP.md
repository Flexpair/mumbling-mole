# Vue.js Migration Preparation - Complete ✅

## Abgeschlossene Vorbereitungen (November 2, 2025)

### 1. ✅ Test Coverage Validierung
- **VoiceState**: 97.82% (Ziel >80% erreicht)
- **AppState**: 78.46% (Ziel >70% erreicht)
- **AudioState**: 93.6%
- **UserState**: 94.3%
- **Gesamt**: 74.16% Statements, 62.2% Branches

**Status**: Migration-Kriterien erfüllt! Die Test-Coverage ist deutlich besser als in den Copilot Instructions dokumentiert.

### 2. ✅ Vue 3 Dependencies installiert
```bash
npm install --save-dev vue@3 @vue/compiler-sfc esbuild-plugin-vue3
```
- `vue@3.5.13` - Vue 3 Runtime
- `@vue/compiler-sfc@3.5.13` - Single File Component Compiler
- `esbuild-plugin-vue3@0.4.2` - esbuild Integration

### 3. ✅ ConnectDialog extrahiert
**Datei**: `app/components/ConnectDialog.js`

Wiederverwendbare Klasse mit:
- Separation of Concerns (State von UI-Logik getrennt)
- Dependency Injection (appState als Constructor-Parameter)
- Migration Notes als Kommentare

**Knockout → Vue Mapping dokumentiert:**
```javascript
// ko.observable() → ref()
// this.visible() → visible.value
// data-bind="visible" → v-show="visible"
// data-bind="value" → v-model="username"
// data-bind="click" → @click="connect"
```

### 4. ✅ Vue Prototype erstellt
**Datei**: `app/components/ConnectDialog.vue`

Vollständiger Vue 3 Component mit:
- **Composition API** (setup script)
- **Reactive State** (ref, reactive, computed)
- **Two-way Binding** (v-model)
- **Event Handling** (@click, @submit.prevent)
- **Dual Runtime Support** (inject für AppState-Integration)
- **Scoped Styles**

**Features demonstriert:**
- Form validation
- Loopback mode toggle
- AudioContext handling (user gesture preservation)
- Guacamole integration
- Computed properties from AppState observables
- Watch for Knockout compatibility

## Nächste Schritte (für tatsächliche Migration)

### Phase 0: Prototype Validation (noch durchführen)
1. **esbuild Vue Plugin konfigurieren** (`build-esbuild.mjs` erweitern)
2. **Dual Runtime testen** (Vue + Knockout parallel)
3. **Stakeholder Demo** (ConnectDialog.vue im Browser zeigen)

### Phase 1: Dual Runtime (2-3 Wochen)
1. Vue Runtime in `index.html` einbinden
2. ConnectDialog.vue neben Knockout-Version mounten
3. Feature-Toggle für A/B-Test
4. Visual Regression Tests

### Phase 2: State Layer (3-4 Wochen)
1. Compatibility Wrapper: `ko.observable` ↔ `ref`
2. AppState Module einzeln migrieren
3. Backward Compatibility sicherstellen

### Phase 3: Templates (4-6 Wochen)
1. ~71 `data-bind` Patterns konvertieren
2. `.vue` Components extrahieren
3. Template Logic tests

### Phase 4: Cleanup (2 Wochen)
1. Knockout entfernen
2. Bundle optimieren
3. Final validation

## Konkrete Dateien erstellt
- ✅ `app/components/ConnectDialog.js` - Extrahierte Knockout-Klasse
- ✅ `app/components/ConnectDialog.vue` - Vue 3 Prototype
- ✅ `docs/VUE_MIGRATION_PREP.md` - Diese Datei

## Technische Details

### Knockout → Vue Patterns
```javascript
// KNOCKOUT
this.visible = ko.observable(false);
this.username = ko.observable("");
this.connect = () => { /* ... */ };

// HTML
<div data-bind="visible: visible()">
  <input data-bind="value: username" />
  <button data-bind="click: connect">Connect</button>
</div>

// VUE 3 COMPOSITION API
const visible = ref(false);
const username = ref("");
const connect = () => { /* ... */ };

// HTML
<div v-show="visible">
  <input v-model="username" />
  <button @click="connect">Connect</button>
</div>
```

### Dual Runtime Integration
```javascript
// main.js (beide Frameworks)
import { createApp } from 'vue';
import ko from 'knockout';

const appState = new AppState(config);

// Vue app mit provide/inject
const vueApp = createApp(App);
vueApp.provide('appState', appState);
vueApp.mount('#vue-root');

// Knockout bindings (parallel)
ko.applyBindings(appState, document.getElementById('knockout-root'));
```

### AudioContext User Gesture Handling
**Kritisch für Loopback-Tests**: AudioContext Resume muss SYNCHRON im Click-Handler passieren:

```javascript
// ✅ CORRECT (Vue)
async function handleToggleLoopback(event) {
  // SYNC in click handler
  if (appState.audio.audioContextManager) {
    appState.audio.audioContextManager.userInteractionDetected = true;
  }
  
  // SYNC resume
  if (!appState.audio.audioContext) {
    await appState.audio.initializeAudioContext();
  }
  
  if (appState.audio.audioContext?.state === 'suspended') {
    await appState.audio.audioContext.resume();
  }
  
  // THEN async operations
  emit('connectLoopback', formData);
}
```

## Build System Erweiterung (TODO)

```javascript
// build-esbuild.mjs - Vue Plugin hinzufügen
import vuePlugin from 'esbuild-plugin-vue3';

const buildConfig = {
  plugins: [
    vuePlugin(), // .vue files kompilieren
    sassPlugin(),
    // ... existing plugins
  ],
  loader: {
    '.vue': 'js', // SFC → JS
  }
};
```

## Testing Strategy

### Unit Tests (existierend)
- ✅ 1058 tests passing
- ✅ Coverage >70% für kritische Module

### Integration Tests (existierend)
- ✅ Playwright Loopback Test (full audio pipeline)
- ✅ UI initialization regression tests

### Vue Tests (benötigt)
- [ ] Vitest setup für Vue components
- [ ] Component unit tests (ConnectDialog.vue)
- [ ] Visual regression tests (Playwright + screenshots)

## Migration Risks & Mitigation

### Risk 1: Audio Pipeline Störung
**Mitigation**: Audio-Code bleibt UNVERÄNDERT (Worker, Opus, AudioWorklet)

### Risk 2: State Synchronisation
**Mitigation**: Compatibility Wrapper, schrittweise Migration

### Risk 3: Performance Regression
**Mitigation**: Dual Runtime nur während Transition, Bundle Size Monitoring

### Risk 4: Browser Compatibility
**Mitigation**: Vue 3 targets ES2015+ (wie bisherige esbuild config)

## Stakeholder Approval Kriterien

Vor Phase 1 Start benötigt:
- ✅ Test Coverage >70% AppState
- ✅ Test Coverage >80% VoiceState  
- ✅ Vue 3 Dependencies installiert
- ✅ Prototype Component erstellt
- [ ] Prototype im Browser validiert
- [ ] Build System Vue-ready
- [ ] Stakeholder Demo durchgeführt
- [ ] Go/No-Go Decision

## Lessons Learned (aus Preparation)

1. **Integration Tests**: Zu komplex mit echtem AppState - Playwright E2E ist besser
2. **Coverage**: Besser als dokumentiert - Migration kann früher starten
3. **Component Extraction**: Relativ einfach - gute Vorbereitung für Vue
4. **Dual Runtime**: Technisch machbar via provide/inject
5. **User Gestures**: AudioContext Handling kritisch - muss in Vue-Komponenten bewahrt werden

---

**Nächster Schritt**: Build System für Vue konfigurieren und Prototype im Browser testen
