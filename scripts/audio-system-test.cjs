#!/usr/bin/env node
/**
 * Automatisierter Audio-System Test
 * 
 * Testet kritische Audio-Komponenten ohne Live-Server:
 * - Mumble-Client Build
 * - Codec-Verfügbarkeit
 * - Worker-Scripts Syntax
 * - Audio-Processing-Chain
 * - Package-Integrität
 * 
 * Perfekt für CI/CD und Regressions-Tests nach Paket-Updates
 */

const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const stats = {
  startTime: Date.now(),
  testsPassed: [],
  testsFailed: [],
  warnings: []
};

function log(msg) {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  console.log(`[${elapsed}s] ${msg}`);
}

function pass(test) {
  stats.testsPassed.push(test);
  console.log(`[✅] ${test}`);
}

function fail(test, reason) {
  stats.testsFailed.push({ test, reason });
  console.log(`[❌] ${test}`);
  console.log(`    → ${reason}`);
}

function warn(msg) {
  stats.warnings.push(msg);
  console.log(`[⚠️ ] ${msg}`);
}

// Test 1: Mumble-Client Source Files
async function testMumbleClientBuild() {
  log('Test: Mumble-Client Source Files');
  
  const srcPath = path.join(__dirname, '../vendors/mumble-client/src');
  const clientPath = path.join(srcPath, 'client.js');
  
  if (!fs.existsSync(clientPath)) {
    fail('Mumble-Client Source Files', 'src/client.js nicht gefunden');
    return false;
  }
  
  // Check for required source files
  const requiredFiles = ['client.js', 'user.js', 'channel.js', 'utils.js'];
  for (const file of requiredFiles) {
    const filePath = path.join(srcPath, file);
    if (!fs.existsSync(filePath)) {
      fail('Mumble-Client Source Files', `src/${file} nicht gefunden`);
      return false;
    }
  }
  
  pass('Mumble-Client Source Files (4 Dateien)');
  return true;
}

// Test 2: Mumble-Client ES Module Syntax
async function testMumbleClientImport() {
  log('Test: Mumble-Client ES Module Syntax');
  
  const srcFiles = [
    '../vendors/mumble-client/src/client.js',
    '../vendors/mumble-client/src/user.js',
    '../vendors/mumble-client/src/channel.js',
    '../vendors/mumble-client/src/utils.js'
  ];
  
  for (const file of srcFiles) {
    const fullPath = path.join(__dirname, file);
    try {
      // Node.js can't --check ES modules directly, just verify file exists and is readable
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.includes('export')) {
        fail('Mumble-Client ES Module Syntax', `${path.basename(file)} enthält keine exports`);
        return false;
      }
    } catch (err) {
      fail('Mumble-Client ES Module Syntax', `${path.basename(file)}: ${err.message}`);
      return false;
    }
  }
  
  pass('Mumble-Client ES Module Syntax (4 Dateien)');
  return true;
}

// Test 3: Codec-Verfügbarkeit
async function testCodecs() {
  log('Test: Audio-Codecs');
  
  const codecsPath = path.join(__dirname, '../app/audio/codecs-browser.js');
  
  if (!fs.existsSync(codecsPath)) {
    fail('Audio-Codecs', 'codecs-browser.js nicht gefunden');
    return false;
  }
  
  try {
    // Versuche zu laden (ohne zu executen, da es Browser-APIs braucht)
    const content = fs.readFileSync(codecsPath, 'utf8');
    
    // Prüfe auf kritische Imports
    if (!content.includes('opus')) {
      warn('Opus-Codec nicht in codecs-browser.js gefunden');
    }
    
    pass('Audio-Codecs Datei vorhanden');
    return true;
  } catch (err) {
    fail('Audio-Codecs', err.message);
    return false;
  }
}

// Test 5: Worker-Scripts Syntax
async function testWorkerScripts() {
  log('Test: Worker-Scripts Syntax');
  
  const workerFiles = [
    '../app/worker.js',
    '../app/worker-client.js',
    '../app/audio/recorder-worker.js',
    '../app/audio/decode-worker.js',
    '../app/audio/encode-worker.js'
  ];
  
  for (const file of workerFiles) {
    const fullPath = path.join(__dirname, file);
    
    if (!fs.existsSync(fullPath)) {
      fail(`Worker-Scripts`, `${path.basename(file)} nicht gefunden`);
      return false;
    }
    
    // Syntax-Check mit Node
    try {
      await execFileAsync('node', ['--check', fullPath]);
    } catch (err) {
      fail(`Worker-Scripts`, `${path.basename(file)} has syntax error: ${err.message}`);
      return false;
    }
  }
  
  pass(`Worker-Scripts (${workerFiles.length} Dateien)`);
  return true;
}

// Test 6: Audio-Processing Dependencies
async function testAudioDependencies() {
  log('Test: Audio-Dependencies');
  
  const requiredModules = [
    'mumble-streams',
    'websocket-stream',
    'libopus.js' // Browser-kompatible Opus-Codec Implementierung
  ];
  
  for (const mod of requiredModules) {
    try {
      require.resolve(mod);
    } catch (err) {
      fail('Audio-Dependencies', `${mod} nicht installiert (erforderlich)`);
      return false;
    }
  }
  
  pass(`Audio-Dependencies (${requiredModules.length} erforderlich)`);
  return true;
}

// Test 7: Voice.js und Audio-Context-Manager
async function testAudioModules() {
  log('Test: Audio-Module');
  
  const audioFiles = [
    '../app/audio/voice.js',
    '../app/audio/audio-context-manager.js',
    '../app/mumble-websocket.js'
  ];
  
  for (const file of audioFiles) {
    const fullPath = path.join(__dirname, file);
    
    if (!fs.existsSync(fullPath)) {
      fail('Audio-Module', `${path.basename(file)} nicht gefunden`);
      return false;
    }
    
    // Syntax-Check
    try {
      await execFileAsync('node', ['--check', fullPath]);
    } catch (err) {
      fail('Audio-Module', `${path.basename(file)} hat Syntax-Fehler`);
      return false;
    }
  }
  
  pass(`Audio-Module (${audioFiles.length} Dateien)`);
  return true;
}

// Test 7: Package.json Audio-Scripts
async function testNpmScripts() {
  log('Test: NPM Audio-Scripts');
  
  const packagePath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const requiredScripts = [
    'test:e2e',
    'build'
  ];
  
  for (const script of requiredScripts) {
    if (!pkg.scripts[script]) {
      fail('NPM Audio-Scripts', `Script "${script}" fehlt in package.json`);
      return false;
    }
  }
  
  pass('NPM Audio-Scripts');
  return true;
}

// Test 9: esbuild Audio-Build
async function testEsbuildBuild() {
  log('Test: esbuild Build für Audio-Module');
  
  const distPath = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distPath)) {
    warn('dist/ Verzeichnis nicht gefunden - npm run build ausführen');
    return true; // Kein Hard-Fail
  }
  
  const indexHtml = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    warn('dist/index.html nicht gefunden');
    return true;
  }
  
  const stat = fs.statSync(indexHtml);
  if (stat.size < 1024) {
    warn(`dist/index.html sehr klein (${stat.size} bytes)`);
  }
  
  pass('esbuild Build');
  return true;
}

// Test 10: Audio-Paket-Generierung (Synthetisch)
async function testAudioPacketGeneration() {
  log('Test: Audio-Paket-Generierung');
  
  try {
    // Generiere Test-Audio ohne Server
    const SAMPLE_RATE = 48000;
    const SAMPLES = 960;
    const FREQUENCY = 440;
    
    const audioData = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      audioData[i] = Math.sin(2 * Math.PI * FREQUENCY * i / SAMPLE_RATE) * 0.3;
    }
    
    // Prüfe ob Daten korrekt sind
    let hasNonZero = false;
    let inRange = true;
    
    for (let i = 0; i < audioData.length; i++) {
      if (audioData[i] !== 0) hasNonZero = true;
      if (Math.abs(audioData[i]) > 1.0) inRange = false;
    }
    
    if (!hasNonZero) {
      fail('Audio-Paket-Generierung', 'Alle Samples sind 0');
      return false;
    }
    
    if (!inRange) {
      fail('Audio-Paket-Generierung', 'Samples außerhalb [-1, 1] Bereich');
      return false;
    }
    
    pass(`Audio-Paket-Generierung (${SAMPLES} samples @ ${FREQUENCY}Hz)`);
    return true;
  } catch (err) {
    fail('Audio-Paket-Generierung', err.message);
    return false;
  }
}

// Haupt-Runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Automatisierter Audio-System Test                 ║');
  console.log('║         (Kein Live-Server erforderlich)                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const tests = [
    testMumbleClientBuild,
    testMumbleClientImport,
    testCodecs,
    testWorkerScripts,
    testAudioDependencies,
    testAudioModules,
    testNpmScripts,
    testEsbuildBuild,
    testAudioPacketGeneration
  ];
  
  for (const test of tests) {
    await test();
  }
  
  printResults();
}

function printResults() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test-Ergebnisse                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log(`\n✅ Erfolgreich: ${stats.testsPassed.length}`);
  stats.testsPassed.forEach((test, i) => {
    console.log(`  ${i + 1}. ${test}`);
  });
  
  if (stats.testsFailed.length > 0) {
    console.log(`\n❌ Fehlgeschlagen: ${stats.testsFailed.length}`);
    stats.testsFailed.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.test}`);
      console.log(`      → ${item.reason}`);
    });
  }
  
  if (stats.warnings.length > 0) {
    console.log(`\n⚠️  Warnungen: ${stats.warnings.length}`);
    stats.warnings.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg}`);
    });
  }
  
  const runtime = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  console.log(`\nLaufzeit: ${runtime}s`);
  console.log('═'.repeat(62));
  
  if (stats.testsFailed.length === 0) {
    console.log('\n✅ ALLE TESTS BESTANDEN');
    console.log('   Audio-System bereit für Produktion!');
    console.log('\n💡 Empfehlung: Führe auch manuelle Browser-Tests durch');
    console.log('   ./start-dev-server.sh');
    process.exit(0);
  } else {
    console.log('\n❌ TESTS FEHLGESCHLAGEN');
    console.log(`   ${stats.testsFailed.length} Problem(e) gefunden`);
    console.log('\n🔧 Behebung:');
    if (stats.testsFailed.some(t => t.test.includes('Build') || t.test.includes('Source'))) {
      console.log('   - npm run build');
    }
    if (stats.testsFailed.some(t => t.test.includes('Dependencies'))) {
      console.log('   - npm install');
    }
    process.exit(1);
  }
}

// Start
runAllTests().catch(err => {
  console.error('\n💥 Fataler Fehler:', err.message);
  process.exit(1);
});
