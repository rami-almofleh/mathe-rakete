import { plain } from '../../models';
import { Rational } from '../../math/rational';
import { answersFor, nearbyFallback, numberFormat } from '../answers';
import { TaskGenerator } from '../generator';

/** Einfacher Beispiel-Generator für Tests der Pipeline (kein echtes Lehrplan-Thema). */
export function fakeAdditionGenerator(topicId = 'k1-add-10'): TaskGenerator {
  return {
    topicId,
    generate: ({ rng }) => {
      const a = rng.int(1, 5);
      const b = rng.int(1, 4);
      const sum = Rational.of(a + b);
      const format = numberFormat();
      return {
        prompt: { math: plain(`${a} + ${b} = ?`) },
        answer: format(sum),
        distractors: answersFor([a + b + 1, a + b - 1, a - b], format),
        fallback: nearbyFallback(sum, format),
      };
    },
  };
}
