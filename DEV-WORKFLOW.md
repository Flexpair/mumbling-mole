# 🚀 Development Quick Sta## 🔒 Security Checks

```bash
npm run security     # Vulnerabilities anzeigen
npm audit fix        # Sichere Fixes (meist OK)
npm audit fix --force   # ⚠️ VORSICHT: Breaking Changes möglich!
```

### ⚠️ **Wichtig:**
- **Vor `--force`:** Backup mit Git oder manuell erstellen
- **Nach Fixes:** `npm run build` testen
- **Falls kaputt:** `git restore package*.json && npm install`äglicher Workflow (Dev Container)

Nach der einmaligen Einrichtung führe diese 3 Schritte **in genau dieser Reihenfolge** aus:

### 1️⃣ App builden
```bash
npm run build        # Standard (schnell, ohne Audit)
# oder
npm run build:audit  # Mit Security-Check (langsam)
```

### 2️⃣ Webserver starten  
```bash
./docker-entrypoint.sh
```

### 3️⃣ Browser öffnen
```
https://local.flexpair.app
```
**⚠️ WICHTIG: Nicht `localhost:8081` verwenden!**

---

## � Security Checks

Regelmäßig (nicht täglich) ausführen:

```bash
npm run security:check    # Vulnerabilities anzeigen
npm run security:fix      # Automatische Fixes
```

---

## �🔧 Einmalige Einrichtung

Nur beim ersten Mal:

```bash
# Im Dev Container:
./setup-local-dev.sh

# Dann auf HOST-System die angezeigten Schritte befolgen
```

---

## 🐛 Troubleshooting

- **CORS-Fehler?** → Nutze `https://local.flexpair.app` statt `localhost`
- **SSL-Fehler?** → Zertifikate mit `mkcert` generiert?
- **App lädt nicht?** → `npm run build` ausgeführt?
- **Port belegt?** → Container neu starten: `docker-compose restart nginx`

---

## 📁 Wichtige Dateien

- `setup-local-dev.sh` - Einmalige Einrichtungsanleitung
- `.devcontainer/nginx/conf.d/default.conf` - NGINX-Konfiguration  
- `docker-entrypoint.sh` - Webserver-Starter
- `package.json` - Build-Scripts
