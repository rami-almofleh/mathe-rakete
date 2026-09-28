# Mathe-Rakete

Mathe-Lern-App für Klasse 1–12 (Angular 22, Bootstrap 5.3, Bootstrap Icons, KaTeX).
Alle Aufgaben werden zur Laufzeit erzeugt – immer 3 Antworten, genau eine ist richtig.
Die falschen Antworten stammen aus typischen Schülerfehlern.

- Plan & Fortschritt: [PLAN.md](PLAN.md)
- Lehrplan-Recherche: [docs/RECHERCHE.md](docs/RECHERCHE.md)

## Entwicklung

```bash
npm install
npm start        # http://localhost:4200
npm test         # Unit-, Komponenten- und Massentests (Vitest)
npm run build    # Produktions-Build nach dist/
```

## Aufbau

```
src/app/
├── core/
│   ├── curriculum/   Themen je Klasse (KMK) + fester Plan für „Rechnen“ in der Grundschule
│   ├── math/         Zufall (seedbar), exakte Brüche, Ausdrucksbaum, Terme, Polynome, Formatierung
│   ├── generators/   Aufgaben-Pipeline + ein Generator je Thema (primary, lower, middle, upper)
│   ├── quiz/         Spielablauf, Timer, Themenauswahl
│   └── progress/     Fortschritt (localStorage), Abzeichen, Töne
├── features/         Startseite, Einstellungen, Quiz, Ergebnis, Fortschritt
└── shared/           Formel-Anzeige (KaTeX), Konfetti
```

## Neues Thema hinzufügen

1. Thema in `core/curriculum/curriculum.ts` eintragen.
2. Generator schreiben (`generator('k7-…', ({ difficulty, rng }) => …)`) mit Lösung, Ablenkern aus
   typischen Fehlern und Lösungsweg – und in `all-generators.ts` registrieren.
3. Im Massentest der Stufe (`*.spec.ts`) eine unabhängige Prüfregel ergänzen.
