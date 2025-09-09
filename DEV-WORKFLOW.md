# 🚀 Development Quick Start

## Täglicher Workflow (Dev Container)

Nach der einmaligen Einrichtung führe diese 3 Schritte **in genau dieser Reihenfolge** aus:

### 1️⃣ App builden
```bash
npm run build
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

## 🔧 Einmalige Einrichtung

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
