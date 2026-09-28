import { FIGURE_GENERATORS } from './figures/figure-generators';
import { TaskGenerator } from './generator';
import { GRADE_5_GENERATORS } from './lower/grade-5';
import { GRADE_6_GENERATORS } from './lower/grade-6';
import { GRADE_7_GENERATORS } from './lower/grade-7';
import { GRADE_8_GENERATORS } from './middle/grade-8';
import { GRADE_9_GENERATORS } from './middle/grade-9';
import { GRADE_10_GENERATORS } from './middle/grade-10';
import { GRADE_11_GENERATORS } from './upper/grade-11';
import { GRADE_12_GENERATORS } from './upper/grade-12';
import { GRADE_1_GENERATORS } from './primary/grade-1';
import { GRADE_2_GENERATORS } from './primary/grade-2';
import { GRADE_3_GENERATORS } from './primary/grade-3';
import { GRADE_4_GENERATORS } from './primary/grade-4';
import { GeneratorRegistry } from './registry';

export const ALL_GENERATORS: readonly TaskGenerator[] = [
  ...GRADE_1_GENERATORS,
  ...GRADE_2_GENERATORS,
  ...GRADE_3_GENERATORS,
  ...GRADE_4_GENERATORS,
  ...GRADE_5_GENERATORS,
  ...GRADE_6_GENERATORS,
  ...GRADE_7_GENERATORS,
  ...GRADE_8_GENERATORS,
  ...GRADE_9_GENERATORS,
  ...GRADE_10_GENERATORS,
  ...GRADE_11_GENERATORS,
  ...GRADE_12_GENERATORS,
  ...FIGURE_GENERATORS,
];

export function createDefaultRegistry(): GeneratorRegistry {
  return new GeneratorRegistry(ALL_GENERATORS);
}
