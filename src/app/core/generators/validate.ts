import { Task } from '../models';
import { CHOICE_COUNT } from './choices';

/**
 * Prüft die Grundregel jeder Aufgabe: genau 3 verschiedene Antworten, genau eine davon
 * ist die erwartete Lösung. Liefert die gefundenen Probleme (leer = gültig).
 */
export function validateTask(task: Task, expectedKey: string): string[] {
  const problems: string[] = [];
  const { choices, correctIndex } = task;

  if (choices.length !== CHOICE_COUNT) {
    problems.push(`${choices.length} statt ${CHOICE_COUNT} Antworten`);
  }
  if (new Set(choices.map((c) => c.key)).size !== choices.length) {
    problems.push('Antworten mit gleichem Wert');
  }
  if (new Set(choices.map((c) => c.display.value)).size !== choices.length) {
    problems.push('Antworten sehen gleich aus');
  }
  if (choices.some((c) => c.display.value.trim() === '')) {
    problems.push('Leere Antwort');
  }
  if (choices[correctIndex]?.key !== expectedKey) {
    problems.push('Richtige Antwort steht nicht an correctIndex');
  }
  const correctCount = choices.filter((c) => c.key === expectedKey).length;
  if (correctCount !== 1) {
    problems.push(`${correctCount} richtige Antworten statt 1`);
  }
  if (task.prompt.math.value.trim() === '') {
    problems.push('Leere Aufgabe');
  }
  return problems;
}
