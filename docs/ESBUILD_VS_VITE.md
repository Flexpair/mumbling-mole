# esbuild vs Vite: Was ist besser für mumbling-mole?

## 🎯 Direkte Empfehlung für Ihr Projekt: **esbuild**

**Warum?** Ihr Projekt hat **sehr spezielle Anforderungen** die Vite kompliziert machen:
- ✅ Web Workers (mehrere!)
- ✅ AudioWorklet Processors (müssen separat bleiben)
- ✅ Vendored packages (mumble-client, netlify-identity)
- ✅ Custom build logic (smart-build.sh, dist/.build-marker)
- ✅ Einfache Web App (keine SSR, kein Framework)

---

## 📊 Vergleich: Dependencies & Größe

### esbuild (Empfohlen)

```json
{
  "devDependencies": {
    "esbuild": "^0.23.0",
    "esbuild-sass-plugin": "^3.0.0",
    "esbuild-plugin-copy": "^2.0.0"
  }
}
```

**Dependencies:**
- Direkt: 3 packages
- Transitiv: ~10-15 packages
- **Total: ~15-20 Dependencies**
- Größe: ~15 MB

### Vite

```json
{
  "devDependencies": {
    "vite": "^5.0.0",
    "vite-plugin-html": "^3.0.0"
  }
}
```

**Dependencies:**
- Direkt: 2 packages
- Transitiv: ~80-100 packages (weil Rollup + Plugins)
- **Total: ~80-100 Dependencies**
- Größe: ~40-50 MB

**Vite = esbuild (Dev) + Rollup (Production)**  
→ Mehr Dependencies, weil zwei Build-Tools drin!

---

## ⚡ Performance-Vergleich

### Build-Geschwindigkeit

| Tool | Clean Build | Incremental | Watch Mode |
|------|-------------|-------------|------------|
| **Webpack+Babel** (aktuell) | 18-25s | 3-8s | 2-4s |
| **esbuild** | **0.5-1s** | **0.1-0.3s** | **<50ms** |
| **Vite (Dev)** | 0.8-1.5s | 0.2-0.5s | <100ms |
| **Vite (Prod)** | 3-6s | 1-2s | N/A |

**esbuild ist schneller** weil:
- Nur ein Tool (kein Rollup für Production)
- Go Binary (vs Rollup in JavaScript)
- Minimale Abstraktion

**Vite Dev ist schnell** aber:
- Production Build nutzt Rollup (langsamer)
- Mehr Konfiguration nötig

---

## 🛠️ Komplexität & Konfiguration

### esbuild: Einfach & Direkt

```javascript
// build.mjs - ~50 Zeilen!
import * as esbuild from 'esbuild'
import { sassPlugin } from 'esbuild-sass-plugin'

await esbuild.build({
  entryPoints: {
    index: 'app/index.js',
    worker: 'app/worker.js',
  },
  bundle: true,
  outdir: 'dist',
  target: 'es2020',
  minify: !isDev,
  plugins: [sassPlugin()],
  
  // Web Worker? Einfach!
  entryPoints: ['app/worker.js'],
  
  // AudioWorklet? Copy!
  // (via plugin oder shell)
})
```

**Vorteile:**
- ✅ Eine Konfiguration
- ✅ Ein Build-Tool (Dev = Production)
- ✅ Explizit (keine Magie)
- ✅ Volle Kontrolle

**Nachteile:**
- ⚠️ Manuell konfigurieren (kein "zero-config")
- ⚠️ Weniger Plugins als Vite

### Vite: Mehr Features, mehr Komplexität

```javascript
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  // Dev-Server mit HMR
  server: { port: 3000 },
  
  // Build mit Rollup
  build: {
    rollupOptions: {
      // Komplexe Worker-Konfiguration
      input: {
        main: 'app/index.html',
        worker: 'app/worker.js'
      }
    }
  },
  
  // AudioWorklet? Kompliziert!
  // Braucht spezielle Plugins + Excludes
  
  // Vendored packages? Tricky!
  resolve: {
    alias: {
      'mumble-client': path.resolve(__dirname, 'vendors/mumble-client/lib')
    }
  }
})
```

**Vorteile:**
- ✅ Dev-Server mit HMR out-of-the-box
- ✅ Großes Plugin-Ecosystem
- ✅ Framework-Support (React, Vue, etc.)
- ✅ Modern defaults

**Nachteile:**
- ⚠️ Zwei Build-Tools (esbuild Dev, Rollup Prod)
- ⚠️ Komplexere Worker-Handhabung
- ⚠️ Mehr Abstraction = weniger Kontrolle
- ⚠️ AudioWorklet braucht spezielle Behandlung

---

## 🔧 Spezifische Anforderungen: mumbling-mole

### 1. Web Workers

**Ihr Projekt hat:**
- `app/worker.js` (Main Worker)
- `app/audio/encode-worker.js`
- `app/audio/decode-worker.js`
- `app/audio/recorder-worker.js` (AudioWorklet!)

**esbuild:**
```javascript
// Explizit und klar
entryPoints: {
  index: 'app/index.js',
  worker: 'app/worker.js',
  'audio/encode-worker': 'app/audio/encode-worker.js',
  'audio/decode-worker': 'app/audio/decode-worker.js',
}

// AudioWorklet separat kopieren
// (wie aktuell in webpack)
```
✅ **Funktioniert genau wie webpack**

**Vite:**
```javascript
// Braucht spezielle Plugins:
import { viteStaticCopy } from 'vite-plugin-static-copy'
import workerPlugin from 'vite-plugin-worker'

// Oder neue URL() Syntax (kompliziert)
new Worker(new URL('./worker.js', import.meta.url), {type: 'module'})
```
⚠️ **Mehr Arbeit, weniger wie aktuell**

### 2. AudioWorklet Processors

**Ihr Code:**
```javascript
// recorder-worker.js - MUSS vanilla ES5 bleiben!
// Darf NICHT gebundled werden
// Wird als separate Datei geladen
```

**esbuild:**
```javascript
// Einfach kopieren (wie webpack)
copy({
  assets: [
    { from: 'app/audio/recorder-worker.js', to: '.' }
  ]
})
```
✅ **Trivial**

**Vite:**
```javascript
// Braucht excludes + spezielle Behandlung
build: {
  rollupOptions: {
    external: ['recorder-worker.js']
  }
}
// + Copy Plugin + ?worker Suffix Tricks
```
⚠️ **Komplizierter**

### 3. Vendored Dependencies

**Ihr Setup:**
```
vendors/mumble-client/lib/     (pre-transpiled)
vendors/netlify-identity-widget/
vendors/mumble-streams/
```

**esbuild:**
```javascript
// Direkt importieren oder external
external: ['vendors/mumble-client']

// Oder in path resolution
```
✅ **Funktioniert**

**Vite:**
```javascript
// Braucht resolve.alias + optimizeDeps config
resolve: {
  alias: {
    'mumble-client': '/vendors/mumble-client/lib'
  }
},
optimizeDeps: {
  exclude: ['mumble-client']
}
```
⚠️ **Mehr Konfiguration**

### 4. Build-Artefakte & smart-build.sh

**Ihr aktuelles System:**
- `smart-build.sh` mit `dist/.build-marker`
- Incremental builds
- Conditional vendor rebuilds

**esbuild:**
```javascript
// Programmatisch einfach integrieren
import * as esbuild from 'esbuild'
import fs from 'fs'

// Check marker
const needsRebuild = !fs.existsSync('dist/.build-marker')

if (needsRebuild) {
  await esbuild.build({...})
  fs.writeFileSync('dist/.build-marker', Date.now())
}
```
✅ **Passt zu aktuellem Workflow**

**Vite:**
```bash
# Vite hat eigenes Caching
# Schwieriger zu integrieren mit custom logic
```
⚠️ **Passt weniger gut**

---

## 📦 Migration-Aufwand

### esbuild: **1-2 Tage**

```bash
# Tag 1: Basic Setup
- build.mjs erstellen (~50 Zeilen)
- Entry points konfigurieren
- Workers als separate entries
- SASS plugin
- Copy AudioWorklet processors

# Tag 2: Testing & Polish
- Alle builds testen
- smart-build.sh integrieren
- package.json scripts
- Tests durchlaufen
```

**Ähnlichkeit zu webpack:** ~80%  
**Breaking Changes:** Minimal

### Vite: **3-5 Tage**

```bash
# Tag 1-2: Konfiguration
- vite.config.js erstellen
- Worker-Plugins konfigurieren
- AudioWorklet excludes
- Vendor aliases
- HMR für Entwicklung

# Tag 3: Production Build
- Rollup config für Workers
- Build-Output-Struktur anpassen
- Asset handling

# Tag 4-5: Testing & Debugging
- Worker-Loading testen
- AudioWorklet separat halten
- Vendor dependencies fixen
- smart-build.sh anpassen
```

**Ähnlichkeit zu webpack:** ~50%  
**Breaking Changes:** Mehr (neue Worker syntax, etc.)

---

## 🎯 Feature-Vergleich

| Feature | esbuild | Vite |
|---------|---------|------|
| **Bundle Speed** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Dependencies** | ⭐⭐⭐⭐⭐ (15) | ⭐⭐⭐ (80) |
| **Simple Config** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Worker Support** | ⭐⭐⭐⭐ (manual) | ⭐⭐⭐⭐⭐ (plugins) |
| **Dev Server** | ⭐⭐ (manual) | ⭐⭐⭐⭐⭐ (built-in) |
| **HMR** | ⭐ (manual) | ⭐⭐⭐⭐⭐ |
| **Plugin Ecosystem** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Framework Support** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Prod = Dev** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Control** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 💡 Entscheidungsmatrix für Ihr Projekt

### Wähle **esbuild** wenn:
- ✅ **Minimale Dependencies** wichtig (15 vs 80)
- ✅ **Maximale Geschwindigkeit** (0.5s vs 3s Production)
- ✅ **Volle Kontrolle** über Build
- ✅ **Einfache Migration** von webpack
- ✅ **Web Workers + AudioWorklet** (wie aktuell behandeln)
- ✅ **Kein Framework** (nur Knockout.js)
- ✅ **Kein HMR** nötig (aktuell nicht vorhanden)

### Wähle **Vite** wenn:
- ✅ **Dev-Server mit HMR** sehr wichtig
- ✅ **Großes Plugin-Ecosystem** benötigt
- ✅ **Framework-Migration** geplant (z.B. zu Vue/React)
- ✅ **Modern defaults** wichtiger als Kontrolle
- ⚠️ **Mehr Dependencies** OK (80 vs 15)
- ⚠️ **Langsamer Prod-Build** OK (3-6s vs 0.5s)
- ⚠️ **Komplexere Config** OK

---

## 🏆 Konkrete Empfehlung

### Für mumbling-mole: **esbuild**

**Gründe:**

1. **Dependencies-Ziel erreichen**
   - esbuild: 632 → 15-20 deps ✅ **-97%**
   - Vite: 632 → 80-100 deps ⚠️ nur -85%

2. **Build-Zeit optimieren**
   - esbuild: 18s → 0.5s ✅ **36x schneller**
   - Vite: 18s → 3-6s ⚠️ nur 3-6x schneller (Production)

3. **Migration-Aufwand**
   - esbuild: 1-2 Tage, 80% ähnlich zu webpack
   - Vite: 3-5 Tage, nur 50% ähnlich

4. **Spezielle Anforderungen**
   - Web Workers: Beide OK, esbuild einfacher
   - AudioWorklet: esbuild einfacher (copy wie webpack)
   - Vendored packages: esbuild direkter
   - smart-build.sh: esbuild passt besser

5. **Projekt-Typ**
   - Vanilla JS + Knockout.js → esbuild perfekt
   - Kein Framework → Vite features unused
   - Keine SSR/HMR nötig → Vite overhead

---

## 🚀 Migration Plan: esbuild (Empfohlen)

### Phase 1: Parallel Setup (Risikofrei)

```bash
# Beide Build-Systeme parallel
npm install --save-dev esbuild esbuild-sass-plugin

# build-esbuild.mjs erstellen
# npm run build:esbuild testen
# Vergleichen: dist-webpack vs dist-esbuild

# Wenn zufrieden → webpack entfernen
```

### Phase 2: Cutover

```bash
# smart-build.sh auf esbuild umstellen
# package.json scripts
# webpack deinstallieren

npm uninstall webpack webpack-cli babel-loader @babel/core ...
```

### Fertig!

- ✅ 15-20 statt 632 Dependencies
- ✅ 15 MB statt 115 MB
- ✅ 0.5s statt 18s Builds
- ✅ Alle Features funktionieren

---

## 🤔 Vite später?

**Wenn Sie später zu Vite wollen:**

```bash
# Von esbuild zu Vite ist einfacher als von webpack!
# Weil:
# - Beide modern
# - Beide ES modules
# - Ähnliche Konzepte

# Von webpack zu Vite ist schwerer
# Weil:
# - Verschiedene Loader-Konzepte
# - Worker-Syntax ändern
# - CommonJS vs ESM
```

**Empfehlung:**
1. ✅ Jetzt: esbuild (schnell, minimal)
2. 🔮 Später: Vite evaluieren wenn:
   - Framework-Migration (Vue/React)
   - HMR wird wichtig
   - Plugin-Ecosystem nötig

---

## 📊 Zusammenfassung

| Kriterium | esbuild | Vite | Gewinner |
|-----------|---------|------|----------|
| Dependencies | 15-20 | 80-100 | **esbuild** |
| Build Speed | 0.5s | 3-6s | **esbuild** |
| Migration | 1-2 Tage | 3-5 Tage | **esbuild** |
| Worker Support | Einfach | Komplex | **esbuild** |
| AudioWorklet | Trivial | Tricky | **esbuild** |
| Dev Server | Manual | Built-in | **Vite** |
| HMR | Nein | Ja | **Vite** |
| Plugins | Wenige | Viele | **Vite** |
| **Für mumbling-mole** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | **esbuild** |

---

## 🎯 Finale Antwort

**esbuild ist besser für Ihr Projekt** weil:

1. **Ziel erreichen:** 632 → 15 deps (-97%)
2. **Maximale Geschwindigkeit:** 0.5s builds
3. **Einfache Migration:** Passt zu webpack-Workflow
4. **Perfekt für Vanilla JS:** Kein Framework-Overhead
5. **Worker + AudioWorklet:** Wie gewohnt behandeln

**Vite wäre besser wenn:**
- Framework-Migration geplant
- HMR essentiell
- Dev-Experience wichtiger als Dependencies

**Start jetzt mit esbuild, Vite später evaluieren falls nötig!**
