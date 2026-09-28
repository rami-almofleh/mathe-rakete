# Mathe-Lern-App – Plan

Angular 22 · Bootstrap 5.3 · Bootstrap Icons · Node/Express-Backend unter `/api` · SQLite

Fachliche Grundlage: [docs/RECHERCHE.md](docs/RECHERCHE.md) (KMK-Bildungsstandards, Kl. 1–12)

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Lehrplan | Deutschland allgemein (KMK), typische Verteilung auf Klassen |
| Inhalte | **Themen je Klasse** (Kl. 1–4 Grundrechenarten, dann Brüche, Prozent, Gleichungen … bis Ableitungen/Integrale) |
| Aufgaben | **Werden zur Laufzeit per Algorithmus erzeugt** – keine JSON-Aufgabenlisten |
| Antworten | Immer **3 Antwortmöglichkeiten, genau 1 richtig**; falsche Antworten aus typischen Schülerfehlern |
| Filter | Rechenarten **+ − · :** und Schwierigkeit **einfach / mittel / schwer** |
| Timer | **Aus**, **pro Aufgabe** (z. B. 10/20/30/60 s) oder **pro Runde** (z. B. 1/2/3/5 min) |
| Speichern | Konto (E-Mail/Passwort) + Server-Datenbank (SQLite) – Profile und Fortschritt sind auf allen Geräten sichtbar, auf denen sich das Kind anmeldet (siehe Phase 13) |
| Sprache | Deutsch, Zahlen im deutschen Format (Dezimalkomma, `·` und `:`) |
| Formeln | Kl. 1–4 als Text in Kinderschrift; Brüche, Potenzen, Wurzeln … mit **KaTeX** (wird erst bei Bedarf geladen) |
| Name | **Mathe-Rakete** |
| Git | macht der Nutzer selbst |

## Architektur

```
src/app/
├── core/
│   ├── models/        Typen: Grade, Difficulty, Operation, Task, Choice, QuizSettings, Timer
│   ├── curriculum/    Themen je Klasse (nur Metadaten) + fester Plan für „Rechnen“ in Kl. 1–4
│   ├── math/          Rng (seedbar), Rational (exakt), Ausdrucksbaum, lineare Terme, Polynome, Formatierung
│   ├── generators/    Pipeline (Antworten, Ablenker, Prüfung, Factory) + ein Generator pro Thema
│   ├── quiz/          QuizSession (Ablauf, Timer), Themenauswahl, Konfiguration
│   └── progress/      ProgressStore (localStorage), Abzeichen, Töne
├── features/          home · setup · quiz · result · progress
└── shared/            <app-math> (Text/KaTeX, passt sich der Breite an), Konfetti
```

**Ablauf einer Aufgabe:** `Generator.generate(schwierigkeit, rng)` → Aufgabe mit exakt berechneter
Lösung → `buildChoices()` erzeugt Ablenker aus Fehlermustern, entfernt Duplikate/ungültige Werte,
füllt bei Bedarf mit „Nachbarwerten“ auf, mischt → **Validierung** (3 verschiedene Antworten, genau
eine = Lösung). Schlägt die Validierung fehl, wird neu erzeugt.

---

## Phase 0 – Recherche & Projekt-Setup
- [x] Lehrplan-Recherche Kl. 1–12 (KMK) → `docs/RECHERCHE.md`
- [x] Fragen geklärt (Lehrplan, Themen, Speichern, Timer)
- [x] Angular-22-Projekt anlegen (standalone, SCSS, Routing, Vitest)
- [x] Bootstrap 5.3 + Bootstrap Icons einbinden
- [x] Kindgerechtes Grund-Theme (Schrift Fredoka/Nunito, Farben, große Buttons)
- [x] Ordnerstruktur `core/` · `features/` · `shared/`
- [x] Domänen-Typen (`core/models`)
- [x] Themen-Katalog Kl. 1–12 (`core/curriculum`)
- [x] App-Rahmen (Navbar) + Routen mit Platzhalter-Seiten
- [x] Startseite: Klasse wählen (1–12, gruppiert nach Grundschule / Mittelstufe / Oberstufe)

## Phase 1 – Mathe-Kern
- [x] `Rng`: seedbarer Zufallsgenerator (reproduzierbar für Tests), `int()`, `pick()`, `shuffle()`
- [x] `Rational`: exakte Brüche (kürzen, +, −, ·, :, Potenz, vergleichen, abbrechende Dezimalzahl erkennen)
- [x] Zahlentheorie: ggT, kgV, Primzahl, Teiler, Primfaktoren
- [x] Formatierung deutsch: `3,5` · `−7` · `1 000` · `·` · `:` · Brüche · Runden · negative Zahlen in Klammern (Text und LaTeX)
- [x] Mathe-Anzeige-Komponente `<app-math>`: Text oder KaTeX (lazy geladen, inkl. MathML für Screenreader)
- [x] `TaskGenerator`-Schnittstelle + `GeneratorRegistry` (Thema → Generator)
- [x] `buildChoices()`: Ablenker aus Fehlermustern, Duplikat-Check (Wert *und* Aussehen), Auffüllen mit Nachbarwerten, Mischen
- [x] Validator: genau 3 verschiedene Antworten, genau 1 korrekt, Zahlenbereich der Klasse (keine negativen Zahlen vor Kl. 7, keine Brüche vor Kl. 6)
- [x] `TaskFactory`: erzeugt, prüft und würfelt bei ungültigen Aufgaben neu (max. 25 Versuche)
- [x] Unit-Tests: Rng, Zahlentheorie, Rational, Formatierung, buildChoices, Validator, Factory, Mathe-Anzeige (39 Tests)

## Phase 2 – Generatoren Grundschule (Kl. 1–4)
- [x] Kl. 1: +/− bis 10 und bis 20 (ohne/mit Zehnerübergang, drei Zahlen), Platzhalter □, Verdoppeln/Halbieren, Vergleichen (<, >, =)
- [x] Kl. 2: +/− bis 100, Einmaleins (Kernaufgaben → alle → □ · 7 = 42), Division ohne Rest, Geld (€/ct), Längen (m/cm)
- [x] Kl. 3: +/− bis 1 000 (0/1/2+ Überträge), Zehnereinmaleins & halbschriftlich, Division mit Rest, Größen (m, km, kg, mm, h/min)
- [x] Kl. 4: schriftlich +/− (bis 6-stellig, Nullen im Minuenden), ·, : (Null im Ergebnis), Runden & Überschlag, Größen mit Komma
- [x] Schwierigkeitsstufen je Thema definiert (Zahlenraum, Übergänge, Schritte)
- [x] Fehlermuster Grundschule: ±1/±10, Übertrag vergessen, „kleinere von größerer Ziffer“, Entbündeln vergessen, plus statt mal, Teilprodukt nicht eingerückt, Null im Quotienten vergessen, Rest ≥ Teiler, 1 h = 100 min, Komma verrutscht, „3,05 € = 35 ct“
- [x] Rechenarten-Filter wird an die Generatoren weitergegeben (z. B. „nur +“ bei *Schriftlich plus und minus*)
- [x] Massentest: 23 Themen × 3 Schwierigkeiten × 1 000 Aufgaben; jede Aufgabe wird **unabhängig aus dem angezeigten Text nachgerechnet** (genau 1 richtige Antwort, Zahlenraum, keine negativen Zahlen)
- [x] Stichproben didaktisch geprüft (unnatürliche Ablenker ersetzt, Geld immer mit 2 Nachkommastellen)

## Phase 3 – Spiel-Ablauf (MVP spielbar)
- [x] Setup-Seite: Modus *Rechnen* (+ − · : wählbar, nicht vorhandene Rechenarten gesperrt) oder *Themen* (Checkliste inkl. frühere Klassen, „bald“ für noch fehlende Generatoren)
- [x] Modus *Rechnen* übt die Themen der höchsten passenden Klasse (Kl. 3 + „+“ → Plus bis 1 000, nicht 4 + 3); Hinweis, falls die eigene Klasse noch keine Aufgaben hat
- [x] Schwierigkeit einfach / mittel / schwer
- [x] Anzahl Aufgaben (10 / 20 / 30)
- [x] Timer: aus / pro Aufgabe (10–90 s, Empfehlung ⭐ je Klasse & Schwierigkeit) / pro Runde (1–5 min)
- [x] Quiz-Seite: große Aufgabe, 3 große farbige Antwort-Buttons, Tasten 1/2/3 und Enter
- [x] Timer-Balken (pulsiert rot am Ende), Zeit abgelaufen = falsch; Zeit steht während der Rückmeldung
- [x] Sofort-Feedback: richtig (grün, Lob, automatisch weiter) / falsch (richtige Antwort + Lösungsweg + „Weiter“ mit Fokus)
- [x] Keine Wiederholung derselben Aufgabe innerhalb einer Runde
- [x] Ergebnis-Seite: Sterne (1–3), richtig/Quote/Zeit, falsche Aufgaben mit Lösungsweg
- [x] „Nochmal“, „Einstellungen“, „Start“; Guards bei Neuladen
- [x] Tests: Themen-Auswahl, Timer (pro Aufgabe/Runde mit simulierter Uhr), Ablauf, Sterne
- [x] Im Browser durchgespielt (Kl. 2 und 3, mit und ohne Timer)
- [x] Didaktik nachgeschärft: Zehner-/Hunderteraufgaben mit passenden Ablenkern (80/100 statt 89/91, „62 + 2“) und Analogie-Lösungsweg („4 + 5 = 9, also 40 + 50 = 90“)

## Phase 4 – Generatoren Unterstufe (Kl. 5–7)
- [x] Kl. 5: Punkt vor Strich & Klammern (27 Vorlagen, passend zu den gewählten Rechenarten), Rechengesetze („Rechne geschickt“ + „Welches Gesetz?“), Potenzen, Teilbarkeit/Primzahlen, Rechteck, Anteile
- [x] Kl. 6: Brüche (kürzen, erweitern, gleichwertig, vergleichen, +, −, ·, :), ggT/kgV, Dezimalzahlen, Bruch↔Dezimal↔Prozent, Quader & Liter
- [x] Kl. 7: negative Zahlen, Prozent (W, p, G), Zinsen (auch Monate), Dreisatz (proportional/antiproportional), Terme (auch Minusklammer), Gleichungen (auch x auf beiden Seiten), Winkel, Mittelwert/Median/Spannweite
- [x] Bausteine: Rechenausdruck-Baum (`expression.ts`, inkl. Fehlerwege „von links nach rechts“ / „Klammer übersehen“ und Rechenweg Schritt für Schritt), lineare Terme (`linear-term.ts`)
- [x] Fehlermuster: Zähler+Zähler/Nenner+Nenner, nicht erweitert, Kehrwert vergessen, Komma nicht untereinander, Kommastellen falsch gezählt, 3/4 → 0,34, Vorzeichenfehler, Grundwert/Prozentwert vertauscht, Endbetrag statt Zinsen, additiv statt proportional, Minusklammer, Winkelsumme 360°, Median der unsortierten Liste …
- [x] Massentest mit **eigenem Formel-Parser** (Klartext + LaTeX) und je Thema eigener Prüfregel: 22 Themen × 3 Stufen × 600 Aufgaben; jede Formel muss von KaTeX fehlerfrei gesetzt werden
- [x] Im Browser geprüft: Brüche mit KaTeX in Aufgabe, Antworten und Lösungsweg; lange Sachaufgaben brechen um

### Korrektur nach Test durch Nutzer (Grundschule)
- [x] **Fester Plan für den Modus „Rechnen“ in Kl. 1–4** (`core/curriculum/arithmetic-plan.ts`): je Klasse × Rechenart × Schwierigkeit genau festgelegt, z. B. Kl. 3 „·“ einfach = nur kleines Einmaleins (bis 10 · 10), Kl. 3 „:“ einfach = ohne Rest
- [x] Kl. 3 Plus/Minus neu gestuft: einfach `345 + 30` / `300 + 400`, mittel `413 + 556`, schwer mehrere Überträge
- [x] Ablenker bleiben im Zahlenraum der Klasse (kein „4 200“ in Kl. 3)
- [x] Tests: Plan-Konsistenz, Kl. 3 „·“ einfach ≤ 10 · 10, Zahlenraum je Klasse für jede Rechenart und Stufe

## Phase 5 – Generatoren Mittelstufe (Kl. 8–10)
- [x] Kl. 8: Ausmultiplizieren (auch mit Minus und x vor der Klammer), Ausklammern (größter Faktor), binomische Formeln (auch rückwärts), Gleichungen mit Klammern, lineare Funktionen (m, b, Steigung aus zwei Punkten, Gleichung aus Punkt, Nullstelle), Dreieck/Parallelogramm/Trapez, Laplace (Würfel, Urne, zwei Würfel)
- [x] Kl. 9: LGS 2×2 (Additionsverfahren), Wurzeln (auch teilweise Wurzel ziehen), Potenzgesetze (auch negative Exponenten), quadratische Gleichungen (inkl. „keine Lösung“), Scheitelpunkt (auch aus der Normalform), Pythagoras (auch gerundet), Kreis
- [x] Kl. 10: rationale Exponenten, Zinseszins/Abnahme/Wachstumsrate, Logarithmus (auch negativ/gebrochen), Trigonometrie (exakte Werte, Seiten, Winkel), Zylinder/Kegel/Kugel, Baumdiagramme (mit/ohne Zurücklegen, „mindestens“)
- [x] `Polynomial` (exakt: ausmultiplizieren, Potenz, Nullstellen-Form, Ableitung, Stammfunktion) für Kl. 8–12
- [x] Gerundete Antworten („≈ 13,9 cm“) mit Schlüssel = gerundeter Wert → nie zwei gleich aussehende Antworten
- [x] Fehlermuster: Mischglied vergessen/nicht verdoppelt, Minus vor der Klammer, nicht der größte Faktor, m und b verwechselt, Δx/Δy vertauscht, x und y vertauscht, negative Lösung vergessen, Vorzeichen im Scheitelpunkt, Wurzel vergessen, Durchmesser statt Radius, linear statt exponentiell, sin/cos verwechselt, Bogenmaß, 1/3 vergessen, „KK, KZ, ZZ → 1/3“, mit statt ohne Zurücklegen …
- [x] Massentest mit unabhängiger Prüfung (u. a. Wahrscheinlichkeiten durch Abzählen aller Ausgänge, Scheitelpunkt/Diskriminante aus Funktionswerten, Gleitkomma-Parser für Wurzeln/π/Exponenten), KaTeX im strengen Modus
- [x] Gefundene Fehler behoben: € in KaTeX nicht vorhanden, doppelte Kreis-Ablenker, zusammenfallende Potenz-Ablenker

## Phase 6 – Generatoren Oberstufe (Kl. 11–12)
- [x] Polynom-Modell (Ableiten, Integrieren, Auswerten, Nullstellen-Form) – aus Phase 5
- [x] Kl. 11: Nullstellen (auch Linearfaktoren und x ausklammern), Ableitungsregeln (auch Bruch-Koeffizienten), Steigung und Tangentengleichung, Extrempunkte (Parabel und kubisch, mit f''-Kriterium), Vektoren (Summe, Betrag, Verbindungsvektor)
- [x] Kl. 12: Ketten- und Produktregel (auch e-Funktion), e und ln (vereinfachen, Gleichungen, Ableitung), Stammfunktion und bestimmtes Integral, Skalarprodukt (Wert, Orthogonalität, Winkel), Stochastik (E(X), P(X = k), bedingte Wahrscheinlichkeit)
- [x] Fehlermuster: Exponent nicht verringert/nicht als Faktor, Konstante stehen gelassen, innere Ableitung vergessen, Ableitungen einfach multipliziert, Potenzregel auf e angewendet, (ln 3x)' = 3/x, Exponent erhöht aber nicht geteilt, Grenzen vertauscht, untere Grenze vergessen, A − B statt B − A, Hoch- und Tiefpunkt verwechselt, Binomialkoeffizient vergessen, falsche Bedingung P(S | O)
- [x] Massentest: Ableitungen **numerisch** geprüft (Differenzenquotient), Integrale mit **Simpson-Regel**, Binomialverteilung durch **Aufzählen aller 2ⁿ Folgen**, Extrema über f' ≈ 0 und f''
- [x] Gefundene Fehler behoben: bei e^{2x} = 4 war der Ablenker ln(4/2) ebenfalls richtig, zusammenfallende Ablenker bei Produktregel (k = 1), Vektoren (A = 0) und Tangente (Steigung 0)
- [x] Einstellungsseite: ab Kl. 8 startet der Modus „Themen“ (Rechnen = Wiederholung)

## Phase 7 – Fortschritt & Motivation
- [x] `ProgressStore` (localStorage, versioniert, repariert kaputte Daten, funktioniert auch ohne/mit vollem Speicher)
- [x] Letzte Einstellungen je Klasse merken (Rechenarten, Themen, Schwierigkeit, Timer, Anzahl)
- [x] Statistik je Thema (richtig/gesamt), Runden, Quote, beste Serie, letzte 30 Runden
- [x] Sterne-Zähler in der Navigation und 12 Abzeichen (z. B. „Fehlerfrei“, „Serie 10“, „Einmaleins-Profi“, „Blitzrechner“)
- [x] Serien-Anzeige im Quiz (🔥 ab 3 richtigen in Folge), Konfetti und „Neues Abzeichen!“ auf der Ergebnisseite
- [x] Töne (Web-Audio, keine Dateien), standardmäßig aus, Schalter in der Navigation
- [x] Fortschritts-Seite (`/fortschritt`) inkl. „Fortschritt zurücksetzen“
- [x] Tests: Speicher (kaputte Daten, blockierter Speicher, Abzeichen nur einmal), Anbindung an die Runde

## Phase 8 – Qualität & Feinschliff
- [x] Responsive geprüft: Handy (375 px), Tablet (768 px), Desktop
- [x] Formeln passen sich automatisch der verfügbaren Breite an (auch nach dem Laden der Schriften und bei Größenänderung); lange Antworten stehen untereinander
- [x] Systematische Browser-Prüfung aller Themen ab Kl. 5 × 3 Stufen auf dem Handy: nichts abgeschnitten
- [x] Barrierefreiheit: große Touch-Flächen, Tastatur (1/2/3, Enter), `aria-live` für Rückmeldung, MathML für Screenreader, Fokus-Rahmen, `prefers-reduced-motion`, Kontraste nach WCAG AA (Lila abgedunkelt, dunkle Ziffern auf farbigen Kreisen)
- [x] Komponenten-Tests (Start, Einstellungen, Quiz inkl. Tastatur, Ergebnis) und Timer-Tests
- [x] Performance: Generatoren und KaTeX werden erst bei Bedarf geladen (Start: 104 kB gezippt)
- [ ] Optional: PWA / offline nutzbar (`ng add @angular/pwa`, eigene App-Icons)
- [ ] Optional: Deployment (z. B. GitHub Pages / Netlify)

## Phase 9 – Aufgaben mit Bild
- [x] Bild-Datenmodell (`Figure`) in der Aufgabe + SVG-Komponente `<app-figure>` (Farben aus dem Theme, skaliert mit, Beschreibung für Screenreader ohne die Lösung zu verraten)
- [x] Kl. 2: Uhr ablesen (volle, halbe, Viertelstunden, 5-Minuten-Schritte; keine übereinanderliegenden Zeiger) – Fehler: Zeiger vertauscht, „halb 8“ als 8:30, Viertel nach ↔ vor, Zahl statt Minuten
- [x] Kl. 3: Fläche und Umfang im Kästchengitter (Rechteck, L-Form, freie Figur ohne Löcher) – Fehler: Fläche ↔ Umfang, umgebendes Rechteck gezählt
- [x] Kl. 5: Winkel (Winkelart; Größe schätzen, auch gedreht und überstumpf) – Fehler: Winkelmesser falsch herum (180° − α), Innen/außen (360° − α); Schätz-Antworten ≥ 25° auseinander
- [x] Kl. 5: Brüche am Bild (Kreis und Streifen, verstreut gefärbt, „nicht gefärbt“, „gekürzt“) – Fehler: gefärbt : ungefärbt, falsch gezählt, ungekürzt
- [x] Kl. 8: Funktionsgleichung am Graphen ablesen (auch Bruch-Steigungen, Gitterpunkte markiert) – Fehler: m und b vertauscht, Steigungsdreieck falsch herum, Vorzeichen
- [x] Massentest: Lösung unabhängig aus den Bilddaten (Kästchen selbst gezählt, Umfang über Kanten, Gerade durch zwei Gitterpunkte); Zeichen-Tests (Zeigerwinkel, Teile, Geradenendpunkte)
- [x] Sichtprüfung im Browser (alle fünf Bildarten)

## Phase 10 – Fehlerschwerpunkte
- [x] Gleitender Sicherheitswert je Thema (neuere Antworten zählen mehr); unsichere Themen kommen in normalen Runden bis zu 4× so oft dran
- [x] Falsch gelöste Aufgaben werden gemerkt (max. 40, neueste zuerst, Zähler bei mehrfachem Fehler)
- [x] Wiederholungsrunde („Fehler üben“): bis zu 10 gemerkte Aufgaben, Antworten neu gemischt; richtig gelöste verschwinden
- [x] Einstiege: Banner auf der Startseite, Knopf auf der Ergebnis-Seite, Karte + „Das übst du bald öfter“ auf der Fortschritts-Seite (Route `/wiederholen`)
- [x] Abzeichen „Aus Fehlern gelernt“
- [x] Tests: Fehlerliste, Unsicherheit je Thema, Bevorzugung unsicherer Themen, Wiederholungsrunde; im Browser durchgespielt

## Phase 11 – Mehrere Kinder-Profile
- [x] Profile (Name, Symbol, Farbe, Klasse, Bundesland) – jedes Profil mit eigenem Fortschritt und eigenen Einstellungen
- [x] Auswahl „Wer übt heute?“, Profil anlegen/bearbeiten/löschen (mit Rückfrage), Profil-Knopf in der Navigation
- [x] Übernahme des bisherigen Fortschritts ins erste Profil
- [x] Startseite begrüßt mit Namen („Weiter in Klasse 3“) und markiert „Deine Klasse“
- [x] Ohne Profil führt jede Seite zuerst zu „Wer übt heute?“
- [x] **Direktsprung:** Ist im Profil eine Klasse gespeichert, springt `/` bei jedem Öffnen sofort zu `/klasse/:grade` – ohne Klasse zeigt `/` weiterhin alle 12 Klassen zur Auswahl
- [x] **Mehrere Profile:** das zuletzt aktive Profil bleibt gespeichert (`activeId`) und wird beim nächsten Öffnen automatisch wieder angezeigt – auch in einem neuen Tab/Fenster
- [x] **Klassen-Chip in der Navigation** („Kl. 3 ⌄“, nur wenn das Profil eine Klasse hat) führt zu `/klassen` (Übersicht aller Klassen) – das ist nur eine vorübergehende Ansicht und ändert die im Profil gespeicherte Klasse nicht
- [x] Tests: Anlegen/Wechseln, getrennter Fortschritt, Übernahme, Löschen, Neuladen, Direktsprung; im Browser geprüft (Klasse wechseln lassen die gespeicherte Klasse unverändert, neuer Tab zeigt das zuletzt aktive Profil)

## Phase 12 – Bundesland-Auswahl
- [x] Recherche: Abweichungen der Themen je Bundesland (Bayern, NRW, Baden-Württemberg, Niedersachsen), Primarstufen-Unterschiede (v. a. schriftliche Division) → `docs/RECHERCHE.md` „Bundesland-Abweichungen"
- [x] `STATE_GRADE_OVERRIDES` in [`states.ts`](src/app/core/curriculum/states.ts): Thema → Klasse je Land; `gradeOf()` löst das auf, `topicsForGrade`/`topicsUpToGrade` nehmen den Zustand als Parameter
- [x] Bundesland je Profil (Feld im Profil-Formular); Einstellungs- und Fortschritts-Seite berücksichtigen es
- [x] Bekannte Lücke dokumentiert: der feste Grundschul-Plan für „Rechnen“ (`arithmetic-plan.ts`) ist noch nicht bundesland-abhängig
- [x] Tests: Konsistenz der Override-Tabelle (gültige Themen/Klassen), Themen wandern in die neue Klasse und verschwinden aus der alten, Wiederholungsliste zieht mit; im Browser geprüft (Bayern-Profil: „Negative Zahlen“ in Kl. 5 statt Kl. 7)

## Phase 13 – Konten & Server-Sync
Bisher lagen Profile und Fortschritt nur lokal im `localStorage` des Geräts. Damit ein Kind auf
mehreren Geräten denselben Fortschritt sieht, gibt es jetzt ein echtes Backend mit Datenbank im
selben Projekt (kein Datei-Export/Import). **Wichtig:** Es gibt keine automatische Übernahme alter
`localStorage`-Daten – wer schon Profile hatte, legt nach der Anmeldung neue Profile an.

- [x] Node/Express-Backend unter `server/` (eigenes `package.json`, TypeScript), erreichbar über `/api`
      auf **derselben Domain** wie das Frontend (in der Produktion bedient ein einziger Express-Prozess
      sowohl `/api/*` als auch die gebauten Angular-Dateien inkl. SPA-Fallback für Deep-Links)
- [x] SQLite (`better-sqlite3`) mit getrennter Datenbank für Entwicklung (`server/data/dev.sqlite`)
      und Produktion (`DATABASE_PATH`, außerhalb des Projektordners) sowie `:memory:` für Tests
- [x] Konten: E-Mail/Passwort-Anmeldung (`bcryptjs`, JWT via `jsonwebtoken`), IP-Rate-Limit auf
      `/register`/`/login`
- [x] Profile und Fortschritt liegen jetzt je Konto auf dem Server (`profiles`, `progress`-Tabellen);
      Sterne sind zusätzlich denormalisiert (`profiles.total_stars`) für die schnelle Profilauswahl
- [x] Frontend „lokal zuerst“: `ProfileStore`/`ProgressStore` aktualisieren ihre Signale sofort und
      schicken die Änderung unabhängig davon im Hintergrund an den Server (kein Warten, kein Blockieren
      der Oberfläche); `hydrate()` holt bei Anmeldung/Profilwechsel den Serverstand
  - [x] neuer `AuthService` (Registrieren/Anmelden/Abmelden, meldet bei abgelaufenem Token automatisch ab) + Login-Seite (`/login`)
- [x] Routen-Wächter: `authReady` (wartet auf die einmalige Token-Prüfung), `needsAuth` (leitet ohne
      Anmeldung zu `/login`); Navigation zeigt „Anmelden“/„Abmelden“ je nach Status
- [x] Ein Befehl startet beides zusammen in der Entwicklung: `npm run dev` (Angular-Dev-Server + Express
      via `concurrently`, `proxy.conf.json` leitet `/api` an den Express-Prozess weiter)
- [x] Tests: 15 Backend-Tests (`node:test`, pro Route: Erfolg, Validierung, fremde Konten/Profile
      bekommen 404), Frontend-Stores gegen einen In-Memory-`FakeApiClient` (`core/testing/fake-api-client.ts`)
      statt echtem Netzwerk
- [x] Produktions-Smoke-Test: `npm run build:all` + `node server/dist/index.js` – ein Prozess liefert
      SPA (inkl. Deep-Link nach Neuladen) und `/api` auf einem Port; im Browser durchgespielt: Konto
      anlegen → Profil anlegen → Runde spielen (Sterne + Abzeichen) → abmelden → erneut anmelden →
      Profil, Klasse, Sterne und Fortschrittsseite (Themen, Abzeichen, Wiederholungsliste) sind unverändert da
- [x] `DEPLOYMENT.md`: Server-Einrichtung von Grund auf (Projekt klonen, SSL-Zertifikat, `.env.production`),
      Build, pm2 (`ecosystem.config.cjs`), nginx/Caddy-Reverse-Proxy-Beispiel, Update-Ablauf mit
      Datenbank-Backup **vor** jedem `git pull`


## Phase 14 – Animationen & Anmelde-Feinschliff
- [x] Anmeldung bleibt 365 Tage gültig (`JWT_EXPIRES_IN`), und jeder App-Start holt über `/api/auth/me` automatisch einen frischen Token – wer die App mindestens einmal im Jahr öffnet, wird nie abgemeldet
- [x] Gemeinsame Animations-Bausteine in `styles.scss` (`ml-pop`, `ml-slide`, `ml-bump`, Wackeln, Hüpfen, Funkeln, Leuchten), gestaffelt über `--i`; bei „weniger Bewegung“ im System praktisch aus
- [x] Seitenwechsel gleiten herein; Startseite: Rakete mit funkelnden Sternen, Klassen-Kacheln ploppen nacheinander auf und hüpfen beim Drüberfahren
- [x] Quiz: jede Aufgabe fliegt neu herein, Antworten ploppen nacheinander auf, bei „richtig“ hüpft der Knopf und Sterne fliegen heraus, Zähler hüpfen bei Änderung, Serien-Flamme flackert
- [x] Ergebnis/Fortschritt/Profil/Einstellungen/Login: Sterne wirbeln herein und funkeln, Werte und Abzeichen ploppen gestaffelt, Balken wachsen, aktives Profil und „Los geht's!“ leuchten sanft
- [x] Fehler behoben: Neuladen einer Unterseite (z. B. `/fortschritt`) landete auf der Startseite – Angular startet alle Guards einer Route gleichzeitig; jetzt wartet jeder Guard selbst auf die Token-Prüfung (`afterAuth` in `app.routes.ts`), `/wiederholen` lädt vorher den Fortschritt
- [x] Nach „Abmelden“ geht es direkt zur Anmelde-Seite

## Phase 15 – Fehler-Logging & Quiz-Absicherung
- [x] Jeder Frontend-Fehler (JavaScript-Fehler, abgelehnte Promises, Fehler beim Zeichnen) geht über `ReportingErrorHandler` → `POST /api/logs` → als `[client]`-JSON-Zeile in `pm2 logs`, mit Gerät, Seite, Benutzer und den letzten 40 „Brotkrumen“ (Quiz-Schritte)
- [x] Fehlgeschlagene Hintergrund-Aufrufe (Netzwerk, 5xx) werden ebenfalls gemeldet; gleiche Fehler in schneller Folge gebündelt (`repeatsSinceLastReport`)
- [x] Server: Zugriffsprotokoll `[api]`, Fehler-Middleware `[api-error]`, `unhandledRejection`/`uncaughtException` werden geloggt
- [x] Quiz-Wächter (jede Sekunde): hängt nach richtiger Antwort → meldet & geht weiter; Timer steht → meldet & startet neu; Kacheln gesperrt obwohl Frage offen → meldet. Zusätzlich „Weiter“-Knopf auch nach richtigen Antworten
- [x] `QuizSession`: scheitert die Erzeugung einer Aufgabe, wird ein anderes Thema versucht; klappt nichts, endet die Runde sauber mit Ergebnis statt festzuhängen
- [x] Nach Updates: alte Tabs, die nicht mehr vorhandene `chunk-*.js` anfordern, laden einmal automatisch neu; der Server antwortet für fehlende Dateien mit 404 statt `index.html`, `index.html` wird nie gecacht
- [x] `trust proxy`: hinter nginx wirkt die Login-Bremse je echter Client-IP statt für alle gemeinsam
