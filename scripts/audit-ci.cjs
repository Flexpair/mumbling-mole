#!/usr/bin/env node
/**
 * Simple npm audit gate with baseline support.
 *
 * Usage:
 *   node scripts/audit-ci.cjs            # exits non-zero if new vulns above thresholds
 *   node scripts/audit-ci.cjs --write-baseline  # updates baseline file
 *
 * Baseline format: stores vulnerability ids+path+severity present when baseline was written.
 * This lets you gradually improve while failing the build only on NEW or ESCALATED issues.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASELINE_FILE = path.join(__dirname, '..', 'audit-baseline.json');
const args = process.argv.slice(2);
const WRITE = args.includes('--write-baseline');

function runAudit() {
  const json = execSync('npm audit --json', { encoding: 'utf8' });
  return JSON.parse(json);
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { vulnerabilities: {} };
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE,'utf8'));
  } catch (e) {
    console.warn('[audit-ci] Could not parse baseline:', e.message);
    return { vulnerabilities: {} };
  }
}

function saveBaseline(report) {
  // Only store vulnerability identifiers, severities, and via/path data for diffing.
  const minimal = { auditReportVersion: report.auditReportVersion, generatedAt: new Date().toISOString(), vulnerabilities: {} };
  for (const [name, vuln] of Object.entries(report.vulnerabilities || {})) {
    minimal.vulnerabilities[name] = {
      name: vuln.name,
      severity: vuln.severity,
      title: vuln.title,
      via: vuln.via, // includes advisory ids or package names
      effects: vuln.effects,
      range: vuln.range,
      nodes: vuln.nodes,
    };
  }
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(minimal, null, 2) + '\n');
  console.log('[audit-ci] Baseline written to', BASELINE_FILE);
}

function summarize(report) {
  const meta = report.metadata?.vulnerabilities || {};
  return `${meta.total} total (critical:${meta.critical} high:${meta.high} moderate:${meta.moderate} low:${meta.low})`;
}

function main() {
  const report = runAudit();

  if (WRITE) {
    saveBaseline(report);
    return;
  }

  const baseline = loadBaseline();

  const newFindings = [];
  for (const [id, vuln] of Object.entries(report.vulnerabilities || {})) {
    const base = baseline.vulnerabilities[id];
    if (!base) {
      newFindings.push({ id, reason: 'NEW', severity: vuln.severity, title: vuln.title });
    } else {
      // Escalation detection: severity increased
      const sevRank = { info:0, low:1, moderate:2, high:3, critical:4 };
      if (sevRank[vuln.severity] > sevRank[base.severity]) {
        newFindings.push({ id, reason: 'ESCALATED', from: base.severity, to: vuln.severity, title: vuln.title });
      }
    }
  }

  if (newFindings.length) {
    console.error('\n[audit-ci] ❌ Build failed. New or escalated vulnerabilities detected.');
    newFindings.forEach(f => {
      if (f.reason === 'NEW') {
        console.error(`  NEW        ${f.severity.padEnd(8)} ${f.id} ${f.title}`);
      } else {
        console.error(`  ESCALATED  ${f.from} -> ${f.to} ${f.id} ${f.title}`);
      }
    });
    console.error('\nCurrent:', summarize(report));
    console.error('Baseline:', summarize({ metadata: { vulnerabilities: severityTotals(baseline) } }));
    console.error('\nUpdate baseline only after reviewing / fixing: npm run audit:baseline');
    process.exit(1);
  } else {
    console.log(`[audit-ci] ✅ No new vulnerabilities (current: ${summarize(report)})`);
  }
}

function severityTotals(baseline) {
  const totals = { info:0, low:0, moderate:0, high:0, critical:0, total:0 };
  for (const v of Object.values(baseline.vulnerabilities || {})) {
    totals[v.severity] = (totals[v.severity]||0)+1;
    totals.total++;
  }
  return totals;
}

main();
