export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type Grade = (typeof GRADES)[number];

/** Schulstufen, nach denen die Startseite gruppiert ist. */
export type SchoolStage = 'primary' | 'lower' | 'middle' | 'upper';

export interface StageInfo {
  readonly id: SchoolStage;
  readonly title: string;
  readonly grades: readonly Grade[];
  readonly icon: string;
}

export const STAGES: readonly StageInfo[] = [
  { id: 'primary', title: 'Grundschule', grades: [1, 2, 3, 4], icon: 'bi-balloon-heart-fill' },
  { id: 'lower', title: 'Unterstufe', grades: [5, 6, 7], icon: 'bi-puzzle-fill' },
  { id: 'middle', title: 'Mittelstufe', grades: [8, 9, 10], icon: 'bi-lightning-charge-fill' },
  { id: 'upper', title: 'Oberstufe', grades: [11, 12], icon: 'bi-mortarboard-fill' },
];

export function isGrade(value: unknown): value is Grade {
  return typeof value === 'number' && (GRADES as readonly number[]).includes(value);
}

export function parseGrade(value: string | null | undefined): Grade | null {
  const n = Number(value);
  return isGrade(n) ? n : null;
}

export function stageOf(grade: Grade): StageInfo {
  return STAGES.find((s) => s.grades.includes(grade))!;
}
