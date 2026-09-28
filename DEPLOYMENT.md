# Deployment – Mathe-Rakete

Diese App besteht aus **einem** Node/Express-Prozess, der sowohl die gebaute Angular-Oberfläche als
auch die API unter `/api` ausliefert – beides auf derselben Domain, demselben Port. Ein
nginx- oder Caddy-Reverse-Proxy (läuft auf dem Server schon) leitet die Domain auf diesen einen
Prozess weiter. pm2 hält den Prozess am Leben und startet ihn nach einem Server-Neustart automatisch
neu. Die Datenbank ist eine einzelne SQLite-Datei außerhalb des Projektordners.

## Voraussetzungen auf dem Server

- Linux-Server mit **nginx oder Caddy**, das bereits läuft und eine Domain auf diesen Server zeigt (z. B. `mathe-rakete.beispiel.de`)
- **Node.js**, Version wie in [`.nvmrc`](.nvmrc) (aktuell 22), z. B. über [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  source ~/.bashrc
  nvm install   # liest die Version aus .nvmrc, sobald man im Projektordner ist
  ```
- **pm2** global installiert:
  ```bash
  npm install -g pm2
  ```
- **git**

## Erstmaliges Einrichten

### 1. Projekt klonen

```bash
sudo mkdir -p /var/www/mathe-rakete
sudo chown "$USER" /var/www/mathe-rakete
git clone <eure-repository-url> /var/www/mathe-rakete
cd /var/www/mathe-rakete
nvm use
```

### 2. SSL-Zertifikat für die Domain erstellen

nginx/Caddy laufen schon auf dem Server, aber **diese App** braucht noch ein eigenes Zertifikat für
ihre Domain (falls die Domain neu ist bzw. noch kein Zertifikat dafür existiert).

**Mit nginx (Certbot):**
```bash
sudo apt install certbot python3-certbot-nginx   # falls noch nicht installiert
sudo certbot --nginx -d mathe-rakete.beispiel.de
```
Certbot trägt die SSL-Konfiguration selbst in den nginx-Server-Block ein und richtet die
automatische Verlängerung ein (Cronjob/Systemd-Timer, je nach Distribution schon vorhanden).

**Mit Caddy:**
Caddy holt und erneuert Zertifikate automatisch, sobald in der `Caddyfile` ein Server-Block mit der
Domain existiert (siehe Reverse-Proxy-Beispiel unten) – kein separater Schritt nötig.

### 3. Umgebungsvariablen für die Produktion anlegen

```bash
cd /var/www/mathe-rakete/server
cp .env.example .env.production
```

`.env.production` bearbeiten und ausfüllen:

```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=<hier einfügen>
JWT_EXPIRES_IN=90d
DATABASE_PATH=/var/lib/mathe-rakete/prod.sqlite
```

`JWT_SECRET` erzeugen (einmalig, dann fest so lassen – ein Wechsel meldet alle Kinder ab):
```bash
openssl rand -base64 48
```

Ordner für die Produktions-Datenbank anlegen (bewusst **außerhalb** des Projektordners, damit
`git pull` sie nie berührt):
```bash
sudo mkdir -p /var/lib/mathe-rakete
sudo chown "$USER" /var/lib/mathe-rakete
```

### 4. Bauen und starten

```bash
cd /var/www/mathe-rakete
npm install                # installiert auch server/ (postinstall-Skript)
npm run build:all          # baut Angular (dist/math-learning) und den Server (server/dist)
pm2 start ecosystem.config.cjs --env production
pm2 save                   # merkt sich den Prozess für den nächsten Server-Neustart
pm2 startup                # gibt einen Befehl aus, der pm2 selbst beim Booten startet – ausführen!
```

Läuft die App, zeigt `pm2 status` den Prozess `mathe-rakete` als `online`.

### 5. Reverse-Proxy einrichten

Die Domain muss auf `127.0.0.1:3000` (den pm2-Prozess) weiterleiten.

**nginx** (Server-Block, z. B. `/etc/nginx/sites-available/mathe-rakete`):
```nginx
server {
    listen 443 ssl;
    server_name mathe-rakete.beispiel.de;

    # Von Certbot in Schritt 2 ergänzt: ssl_certificate / ssl_certificate_key

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 80;
    server_name mathe-rakete.beispiel.de;
    return 301 https://$host$request_uri;
}
```
Aktivieren und neu laden:
```bash
sudo ln -s /etc/nginx/sites-available/mathe-rakete /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Caddy** (`Caddyfile`):
```caddyfile
mathe-rakete.beispiel.de {
    reverse_proxy 127.0.0.1:3000
}
```
Neu laden: `sudo systemctl reload caddy`

Danach ist die App unter `https://mathe-rakete.beispiel.de` erreichbar.

## Aktualisieren (jedes spätere Deployment)

**Wichtig: immer zuerst die Produktions-Datenbank sichern, bevor `git pull` läuft.**

```bash
cd /var/www/mathe-rakete

# 1. Datenbank sichern (Dateiname mit Datum, damit nichts überschrieben wird)
sqlite3 /var/lib/mathe-rakete/prod.sqlite ".backup /var/lib/mathe-rakete/backup-$(date +%F-%H%M).sqlite"

# 2. Neuen Code holen
git pull

# 3. Neu bauen (neue/aktualisierte Abhängigkeiten inklusive)
npm install
npm run build:all

# 4. Ohne Downtime neu laden
pm2 reload mathe-rakete
```

Ist `sqlite3` (die Kommandozeile) nicht installiert, tut es notfalls auch eine einfache Kopie bei
gestopptem Prozess:
```bash
pm2 stop mathe-rakete
cp /var/lib/mathe-rakete/prod.sqlite /var/lib/mathe-rakete/backup-$(date +%F-%H%M).sqlite
pm2 start mathe-rakete
```
(Die `.backup`-Kommando-Variante oben ist vorzuziehen, weil sie **ohne Stopp** funktioniert und auch
mitten in einem Schreibvorgang ein konsistentes Abbild erzeugt.)

Alte Sicherungen sind reine Dateien unter `/var/lib/mathe-rakete/` – von Zeit zu Zeit von Hand
aufräumen (z. B. alles älter als 30 Tage löschen).

## Nützliche pm2-Befehle

```bash
pm2 status                 # läuft der Prozess?
pm2 logs mathe-rakete       # Live-Logs (auch unter /var/log/mathe-rakete/{out,error}.log)
pm2 restart mathe-rakete    # harter Neustart (kurzer Ausfall)
pm2 reload mathe-rakete     # Neustart ohne Downtime (für Updates, siehe oben)
```

## Fehlerbehebung

| Symptom | Ursache / Lösung |
|---|---|
| `pm2 status` zeigt `errored` | `pm2 logs mathe-rakete --lines 50` prüfen. Meist eine fehlende/falsche Variable in `server/.env.production` (siehe Fehlermeldung „Fehlende Pflicht-Umgebungsvariable …“). |
| 502 Bad Gateway vom Reverse-Proxy | Der Node-Prozess läuft nicht oder nicht auf Port 3000 (`PORT` in `.env.production` prüfen, `pm2 status`). |
| Seite lädt, aber ein Neuladen auf einer Unterseite (z. B. `/fortschritt`) zeigt 404 | `dist/math-learning/browser` fehlt oder ist veraltet → `npm run build:all` erneut ausführen. |
| Kinder werden nach einem Update plötzlich abgemeldet | `JWT_SECRET` wurde geändert – alle bestehenden Anmeldungen (Tokens) werden damit ungültig. `JWT_SECRET` nach dem ersten Einrichten nicht mehr ändern. |
| Datenbank-Datei wächst unerwartet oder wirkt beschädigt | Mit der letzten Sicherung unter `/var/lib/mathe-rakete/backup-*.sqlite` wiederherstellen: `pm2 stop mathe-rakete`, Backup-Datei auf `prod.sqlite` kopieren, `pm2 start mathe-rakete`. |
| SSL-Zertifikat abgelaufen | Bei Certbot sollte die automatische Verlängerung laufen (`sudo certbot renew --dry-run` zum Testen); Caddy erneuert automatisch. |
