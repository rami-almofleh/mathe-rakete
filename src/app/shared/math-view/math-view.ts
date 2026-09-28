import { afterRenderEffect, Component, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { MathContent } from '../../core/models';
import { loadKatex } from './katex-loader';

/** Kleinste Schriftgröße (relativ), bis zu der verkleinert wird, damit nichts abgeschnitten wird. */
const MIN_SCALE = 0.45;

/**
 * Zeigt Aufgaben und Antworten: einfacher Text in der Kinderschrift oder – bei `tex` –
 * mit KaTeX gesetzt (inkl. MathML für Screenreader). Passt die Schriftgröße automatisch
 * an, wenn die Formel breiter als der verfügbare Platz ist (z. B. auf dem Handy).
 */
@Component({
  selector: 'app-math',
  template: `
    @if (content().kind === 'plain') {
      <span class="math-plain" [class.short]="content().value.length <= 24">{{ content().value }}</span>
    } @else {
      <span #texHost class="math-tex"></span>
    }
  `,
  styles: `
    :host { display: inline-block; max-width: 100%; vertical-align: middle; }
    .math-plain { font-family: var(--ml-font-display); }
    /* Kurze Rechnungen nicht umbrechen („47 + 38 = ?“), lange Sätze schon */
    .math-plain.short { white-space: nowrap; }
    .math-tex { display: block; }
  `,
  host: { '(window:resize)': 'fit()' },
})
export class MathView {
  readonly content = input.required<MathContent>();
  /** Abgesetzte Formel (größer, zentriert) statt Formel im Fließtext. */
  readonly block = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly texHost = viewChild<ElementRef<HTMLElement>>('texHost');

  constructor() {
    // Text: nach dem Rendern messen
    afterRenderEffect(() => {
      if (this.content().kind === 'plain') this.fit();
    });

    // Formel: KaTeX setzt synchron ins DOM – direkt danach messen
    effect(() => {
      const content = this.content();
      const displayMode = this.block();
      const texHost = this.texHost()?.nativeElement;
      if (content.kind !== 'tex' || !texHost) return;
      texHost.dataset['tex'] = content.value;
      void loadKatex().then((katex) => {
        // Inhalt hat sich während des Ladens geändert → veraltetes Rendern überspringen
        if (texHost.dataset['tex'] !== content.value) return;
        // \displaystyle: Brüche auch in Antworten und Lösungswegen in voller Größe – für Kinder besser lesbar
        katex.render(`\\displaystyle ${content.value}`, texHost, { displayMode, throwOnError: false, output: 'htmlAndMathml' });
        this.fit();
        // KaTeX-Schriften laden evtl. erst jetzt – danach ist die Formel breiter oder schmaler
        void document.fonts?.ready.then(() => this.fit());
      });
    });
  }

  /**
   * Schrift schrittweise verkleinern, bis der Inhalt in die Breite des umgebenden Elements passt.
   * Gemessen wird gegen den Platz im Elternelement – nicht gegen die eigene Breite, denn KaTeX
   * lässt z. B. bei Wurzeln ein paar Pixel überstehen, ohne dass etwas abgeschnitten wird.
   */
  protected fit(): void {
    const el = this.host.nativeElement;
    const parent = el.parentElement;
    if (!parent) return;
    const style = getComputedStyle(parent);
    const available = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    el.style.fontSize = '';
    if (!(available > 0)) return; // unsichtbar (z. B. ausgeblendet) – nichts zu messen
    let scale = 1;
    while (el.scrollWidth > available + 1 && scale > MIN_SCALE) {
      scale -= 0.05;
      el.style.fontSize = `${scale.toFixed(2)}em`;
    }
  }
}
