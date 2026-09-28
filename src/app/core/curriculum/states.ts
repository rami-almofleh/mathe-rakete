import { Grade } from '../models';

export interface StateOption {
  readonly id: string;
  readonly label: string;
}

/** Auswahl im Profil; `de` = typische Verteilung nach KMK (für alle anderen Länder/unentschieden). */
export const STATE_OPTIONS: readonly StateOption[] = [
  { id: 'de', label: 'Deutschland allgemein' },
  { id: 'by', label: 'Bayern' },
  { id: 'bw', label: 'Baden-Württemberg' },
  { id: 'ni', label: 'Niedersachsen' },
  { id: 'nw', label: 'Nordrhein-Westfalen' },
];

/**
 * Abweichungen vom Standard-Katalog je Bundesland (Gymnasium): Thema → Klasse, in der es dort
 * unterrichtet wird. Recherchiert aus den offiziellen Lehrplänen; Einzelheiten, Quellen und
 * Unsicherheiten stehen in docs/RECHERCHE.md („Bundesland-Abweichungen“). Fehlt ein Thema hier,
 * gilt die Klasse aus dem Standard-Katalog (`de`).
 */
export const STATE_GRADE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, Grade>>>> = {
  de: {},

  // Bayern – LehrplanPLUS Gymnasium (G9)
  by: {
    'k7-integers': 5,
    'k7-rule-of-three': 5,
    'k5-fraction-of': 6,
    'k7-percent': 6,
    'k7-interest': 6,
    'k8-areas': 6,
    'k8-expand-factor': 7,
    'k8-binomial': 7,
    'k8-equations-brackets': 7,
    'k9-linear-systems': 8,
    'k9-circle': 8,
    'k9-power-laws': 8,
    'k10-rational-exponents': 9,
    'k10-trigonometry': 9,
    'k11-roots-polynomials': 10,
    'k11-vectors': 12,
  },

  // Baden-Württemberg – Bildungsplan 2016 Gymnasium (G8). Achtung: BW stellt gerade auf G9 um,
  // ein neuer Plan war zur Recherchezeit noch nicht geprüft.
  bw: {
    'k7-integers': 5,
    'k6-cuboid': 5,
    'k5-fraction-of': 6,
    'k7-rule-of-three': 6,
    'k8-areas': 6,
    'k9-circle': 6,
    'k8-expand-factor': 7,
    'k8-linear-functions': 7,
    'k9-linear-systems': 8,
    'k9-roots': 8,
    'k9-quadratic-equations': 8,
    'k9-parabola-vertex': 8,
    'k10-tree-diagrams': 8,
    'k10-rational-exponents': 9,
    'k10-growth': 9,
    'k10-logarithm': 9,
    'k10-trigonometry': 9,
    'k10-solids': 9,
    'k11-roots-polynomials': 10,
    'k11-derivative-rules': 10,
    'k11-tangent-slope': 10,
    'k11-extrema': 10,
    'k11-vectors': 10,
    'k12-stochastics': 10,
    'k12-derivative-advanced': 11,
    'k12-exp-ln': 11,
    'k12-integrals': 11,
  },

  // Niedersachsen – Kerncurriculum Gymnasium (G9)
  ni: {
    'k6-fraction-simplify': 5,
    'k6-cuboid': 5,
    'k5-divisibility': 6,
    'k7-triangle-angles': 6,
    'k7-mean-median': 6,
    'k8-laplace': 7,
    'k9-linear-systems': 8,
    'k10-tree-diagrams': 8,
    // schriftliche Division ist in der Grundschule nur „nicht routiniert“ – wird in Kl. 5/6 vertieft
    'k4-written-div': 5,
    'k9-power-laws': 10,
    'k9-circle': 10,
    'k11-vectors': 12,
  },

  // Nordrhein-Westfalen – Kernlehrplan Gymnasium (G9, 2019)
  nw: {
    'k7-mean-median': 5,
    'k7-rule-of-three': 5,
    'k5-divisibility': 6,
    'k5-powers': 6,
    'k8-expand-factor': 7,
    'k8-binomial': 7,
    'k8-equations-brackets': 7,
    'k8-areas': 7,
    'k8-laplace': 7,
    'k9-linear-systems': 8,
    'k10-tree-diagrams': 8,
    // schriftliche Division muss in der Grundschule nur erklärt, nicht sicher beherrscht werden
    'k4-written-div': 5,
    'k10-rational-exponents': 9,
  },
};
