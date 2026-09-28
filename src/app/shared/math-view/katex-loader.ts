type Katex = typeof import('katex').default;

let katexPromise: Promise<Katex> | undefined;

/** KaTeX (~270 kB) wird erst geladen, wenn eine Aufgabe wirklich Formelsatz braucht. */
export function loadKatex(): Promise<Katex> {
  katexPromise ??= import('katex').then((m) => m.default);
  return katexPromise;
}
