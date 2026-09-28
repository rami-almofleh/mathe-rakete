import { TestBed } from '@angular/core/testing';
import { plain, tex } from '../../core/models';
import { MathView } from './math-view';

describe('MathView', () => {
  it('renders plain content as text', async () => {
    const fixture = TestBed.createComponent(MathView);
    fixture.componentRef.setInput('content', plain('8 + 5 = ?'));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.math-plain')?.textContent).toBe('8 + 5 = ?');
    expect(el.querySelector('.katex')).toBeNull();
  });

  it('typesets tex content with KaTeX', async () => {
    const fixture = TestBed.createComponent(MathView);
    fixture.componentRef.setInput('content', tex('\\frac{1}{2}'));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(el.querySelector('.katex')).not.toBeNull());
    expect(el.querySelector('.mfrac')).not.toBeNull();
  });
});
