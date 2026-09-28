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

### 2. Umgebungsvariablen für die Produktion anlegen

```bash
cd /var/www/mathe-rakete/server
cp .env.example .env.production
```

Vorher kurz prüfen, ob Port 3000 auf diesem Server überhaupt frei ist – auf einem Server mit
mehreren Apps (z. B. per pm2) ist er das oft nicht:
```bash
sudo ss -tlnp | grep :3000
```
Kommt da eine Zeile zurück (ein Prozess lauscht schon auf dem Port), einfach einen anderen freien
Port wählen (z. B. 3001, 3002, …) – unten bei `PORT` eintragen und später beim `proxy_pass` im
Reverse-Proxy (Schritt 4) denselben Port verwenden.

`.env.production` bearbeiten und ausfüllen:

```bash
NODE_ENV=production
PORT=3000
JWT_SECRET=<hier einfügen>
JWT_EXPIRES_IN=365d
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

Ordner für die pm2-Logs anlegen (`ecosystem.config.cjs` schreibt nach `/var/log/mathe-rakete/` –
dieser Ordner gehört sonst `root` und der eigene Nutzer darf ihn nicht selbst anlegen):
```bash
sudo mkdir -p /var/log/mathe-rakete
sudo chown "$USER" /var/log/mathe-rakete
```

### 3. Bauen und starten

```bash
cd /var/www/mathe-rakete
npm install                # installiert auch server/ (postinstall-Skript)
npm run build:all          # baut Angular (dist/math-learning) und den Server (server/dist)
pm2 start ecosystem.config.cjs --env production
pm2 save                   # merkt sich den Prozess für den nächsten Server-Neustart
pm2 startup                # gibt einen Befehl aus – den ausgegebenen Befehl kopieren und separat ausführen!
```
`pm2 startup` startet noch nichts von selbst – es gibt nur einen fertigen `sudo env PATH=...`-Befehl
aus, der zu **eurem** System passt (Pfade, Nutzername). Diesen ausgegebenen Befehl 1:1 kopieren und
ausführen, erst dann startet pm2 nach einem Server-Neustart automatisch mit.

Danach prüfen, ob der Prozess wirklich läuft – und zwar nicht nur direkt nach dem Start, sondern
auch noch nach ein paar Sekunden, um einen Absturz-Loop auszuschließen (steigt `↺` immer weiter,
crasht die App ständig neu – meist, weil der Port doch nicht frei war, siehe Schritt 2):
```bash
pm2 status                 # mathe-rakete sollte "online" sein, nicht "errored" oder "stopped"
sleep 15 && pm2 status      # ↺ sollte sich gegenüber eben NICHT erhöht haben
```

### 4. Reverse-Proxy einrichten (erst ohne SSL)

Die Domain muss auf `127.0.0.1:<euer PORT>` (Standard 3000, oder der Port aus Schritt 2, falls 3000
belegt war) weiterleiten. Bei nginx zuerst **nur** einen
HTTP-Server-Block anlegen – Certbot braucht diesen Block im nächsten Schritt, um die Domain zu
erkennen und die SSL-Zeilen selbst zu ergänzen. Ihn also noch nicht von Hand mit `listen 443 ssl`
schreiben.

**nginx** (Server-Block, z. B. `/etc/nginx/sites-available/mathe-rakete`):
```nginx
server {
    listen 80;
    server_name mathe-rakete.beispiel.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Aktivieren und neu laden:
```bash
sudo ln -s /etc/nginx/sites-available/mathe-rakete /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
Zur Probe (noch ohne SSL): `http://mathe-rakete.beispiel.de` sollte jetzt schon die App zeigen.

**Caddy** (`Caddyfile`):
```caddyfile
mathe-rakete.beispiel.de {
    reverse_proxy 127.0.0.1:3000
}
```
Neu laden: `sudo systemctl reload caddy`

Caddy holt sich beim Neuladen automatisch ein Zertifikat für die Domain und schaltet direkt auf
HTTPS um – **für Caddy ist Schritt 5 damit bereits erledigt**, dort weiter mit Schritt 6.

### 5. SSL-Zertifikat holen (nur nginx – bei Caddy schon erledigt)

Erst jetzt, nachdem der Server-Block aus Schritt 4 existiert und aktiv ist, kann Certbot die Domain
finden und den Block automatisch um die SSL-Konfiguration ergänzen:
```bash
sudo apt install certbot python3-certbot-nginx   # falls noch nicht installiert
sudo certbot --nginx -d mathe-rakete.beispiel.de
```
Certbot trägt `ssl_certificate`/`ssl_certificate_key` selbst in den Server-Block ein, ergänzt einen
zweiten Block für die Weiterleitung von Port 80 auf 443 und richtet die automatische Verlängerung
ein (Cronjob/Systemd-Timer, je nach Distribution schon vorhanden).

Danach ist die App unter `https://mathe-rakete.beispiel.de` erreichbar.

### 6. Fertig prüfen

```bash
pm2 status                                          # mathe-rakete sollte "online" sein
curl -I https://mathe-rakete.beispiel.de/api/auth/me # 401 ist hier normal (kein Token mitgeschickt)
```
Im Browser die Domain öffnen: Es sollte die Anmelde-Seite erscheinen.

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

## Fehler aus dem Browser nachverfolgen

Jeder Fehler im Browser (auch auf den Geräten der Kinder) wird automatisch an den Server geschickt
und steht im pm2-Log – zusammen mit Seite, Gerät/Browser, Benutzer-ID und den letzten Quiz-Schritten
davor („breadcrumbs“). Zeilen-Präfixe:

| Präfix | Bedeutung | Log-Datei |
|---|---|---|
| `[client]` | Fehler oder Hänger aus dem Browser (eine JSON-Zeile) | `error.log` |
| `[api]` | jede API-Anfrage: Methode, Pfad, Status, Dauer, Benutzer | `out.log` (5xx in `error.log`) |
| `[api-error]` | unerwarteter Fehler in einer Server-Route, mit Stacktrace | `error.log` |

`kind` in `[client]`-Zeilen: `error` (JavaScript-Fehler), `stuck` (Quiz hing fest – z. B. „Nach richtiger
Antwort ging es nicht automatisch weiter“; der Quiz-Wächter hat es dann automatisch repariert),
`api` (Verbindungsproblem oder Serverfehler bei einem Hintergrund-Aufruf), `chunk-reload` (Tab war
noch von vor einem Update offen und wurde neu geladen).

```bash
pm2 logs mathe-rakete --lines 200 | grep "\[client\]"          # nur Browser-Berichte
grep "\[client\]" /var/log/mathe-rakete/error.log | tail -20      # dasselbe direkt aus der Datei
grep "\[client\]" /var/log/mathe-rakete/error.log | tail -1 | sed 's/^.*\[client\] //' | python3 -m json.tool   # letzten Bericht lesbar
```

## Fehlerbehebung

| Symptom | Ursache / Lösung |
|---|---|
| `pm2 status` zeigt `errored` | `pm2 logs mathe-rakete --lines 50` prüfen. Meist eine fehlende/falsche Variable in `server/.env.production` (siehe Fehlermeldung „Fehlende Pflicht-Umgebungsvariable …“). |
| 502 Bad Gateway vom Reverse-Proxy | Der Node-Prozess läuft nicht oder nicht auf dem im `proxy_pass` erwarteten Port (`PORT` in `.env.production` mit dem `proxy_pass`-Port abgleichen, `pm2 status`). |
| `pm2 status` zeigt `↺` (Neustarts), die immer weiter steigen, oft mit 100% CPU | Meist ein Port-Konflikt: ein anderer Prozess (eigene App oder fremd) hält den konfigurierten Port schon. Prüfen mit `sudo ss -tlnp \| grep :<PORT>` – zeigt eine fremde PID, `PORT` in `.env.production` auf einen freien Port ändern, `pm2 restart mathe-rakete --update-env`, `proxy_pass` im Reverse-Proxy entsprechend anpassen. |
| Seite lädt, aber ein Neuladen auf einer Unterseite (z. B. `/fortschritt`) zeigt 404 | `dist/math-learning/browser` fehlt oder ist veraltet → `npm run build:all` erneut ausführen. |
| Kinder werden nach einem Update plötzlich abgemeldet | `JWT_SECRET` wurde geändert – alle bestehenden Anmeldungen (Tokens) werden damit ungültig. `JWT_SECRET` nach dem ersten Einrichten nicht mehr ändern. |
| Datenbank-Datei wächst unerwartet oder wirkt beschädigt | Mit der letzten Sicherung unter `/var/lib/mathe-rakete/backup-*.sqlite` wiederherstellen: `pm2 stop mathe-rakete`, Backup-Datei auf `prod.sqlite` kopieren, `pm2 start mathe-rakete`. |
| SSL-Zertifikat abgelaufen | Bei Certbot sollte die automatische Verlängerung laufen (`sudo certbot renew --dry-run` zum Testen); Caddy erneuert automatisch. |
