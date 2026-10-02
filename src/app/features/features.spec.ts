import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiClient } from '../core/auth/api-client';
import { FakeApiClient } from '../core/testing/fake-api-client';
import { QuizSession } from '../core/quiz/quiz-session';
import { ClientLogger } from '../core/logging/client-logger';
import { GradePage } from './grade/grade-page';
import { HomePage } from './home/home-page';
import { LessonPage } from './lesson/lesson-page';
import { ProfileStore } from '../core/progress/profile-store';
import { ProgressStore } from '../core/progress/progress-store';
import { QuizPage } from './quiz/quiz-page';
import { ResultPage } from './result/result-page';
import { SetupPage } from './setup/setup-page';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: '**', children: [] }]), { provide: ApiClient, useValue: new FakeApiClient() }],
  });
}

describe('HomePage', () => {
  beforeEach(setup);

  it('shows all twelve grades grouped by school stage', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.grade-tile').length).toBe(12);
    expect(el.textContent).toContain('Grundschule');
    expect(el.textContent).toContain('Oberstufe');
  });
});

describe('GradePage (Lektionsliste)', () => {
  beforeEach(setup);

  it('lists lessons grouped by chapter with a progress bar', async () => {
    const fixture = TestBed.createComponent(GradePage);
    fixture.componentRef.setInput('grade', '3');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('.chapter-title')].map((h) => h.textContent?.trim())).toEqual([
      'Plus und Minus bis 1 000',
      'Mal und geteilt',
      'Größen',
      'Geometrie',
    ]);
    expect(el.querySelectorAll('a.lesson-row').length).toBe(6);
    expect(el.querySelector('a.lesson-row')?.getAttribute('href')).toBe('/klasse/3/lektion/k3-add-1000');
    expect(el.querySelectorAll('.lesson-row .seg').length).toBe(24);
    expect(el.querySelector('.free-practice')?.getAttribute('href')).toBe('/klasse/3/frei');
  });

  it('colours the bar and marks the last lesson after playing', async () => {
    TestBed.inject(ProfileStore).create({ name: 'Lena', icon: 'bi-star-fill', color: 'sun', grade: 3, state: 'de' });
    const progress = TestBed.inject(ProgressStore);
    TestBed.tick(); // Profilwechsel-Effekt (lädt Fortschritt) vor der Runde abschließen
    await progress.hydrate();
    const settings = { grade: 3 as const, mode: 'topics' as const, operations: [], topicIds: ['k3-units'], difficulty: 'easy' as const, timer: { mode: 'off' as const }, taskCount: 1 };
    const session = TestBed.inject(QuizSession);
    session.start({ ...settings, lesson: { topicId: 'k3-units', step: 'easy' } });
    session.answer(session.task()!.correctIndex);
    session.next();
    expect(progress.lesson('k3-units').steps.easy).toBe(3);

    const fixture = TestBed.createComponent(GradePage);
    fixture.componentRef.setInput('grade', '3');
    await fixture.whenStable();
    const row = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.lesson-row')].find((r) => r.textContent?.includes('Größen umrechnen'))!;
    expect(row.querySelectorAll('.seg-done').length).toBe(1);
    expect(row.textContent).toContain('Zuletzt geübt');
  });
});

describe('LessonPage', () => {
  beforeEach(setup);

  it('shows level 1–3 and test and starts the chosen step', async () => {
    const fixture = TestBed.createComponent(LessonPage);
    fixture.componentRef.setInput('grade', '3');
    fixture.componentRef.setInput('topicId', 'k3-add-1000');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const cards = [...el.querySelectorAll<HTMLButtonElement>('.step-card')];
    expect(cards.map((c) => c.querySelector('.fs-5')?.textContent?.trim())).toEqual(['Level 1', 'Level 2', 'Level 3', 'Test']);
    expect(cards[0].classList).toContain('next');
    expect(cards[3].classList).toContain('quiet');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    cards[3].click();
    const session = TestBed.inject(QuizSession);
    expect(session.settings()?.lesson).toEqual({ topicId: 'k3-add-1000', step: 'test' });
    expect(session.settings()?.taskCount).toBe(10);
    expect(navigate).toHaveBeenCalledWith(['/quiz']);
    session.abandon();
  });

  it('handles unknown lessons', async () => {
    const fixture = TestBed.createComponent(LessonPage);
    fixture.componentRef.setInput('grade', '3');
    fixture.componentRef.setInput('topicId', 'gibt-es-nicht');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Diese Lektion gibt es (noch) nicht');
  });
});

describe('SetupPage', () => {
  beforeEach(setup);

  async function render(grade: string) {
    const fixture = TestBed.createComponent(SetupPage);
    fixture.componentRef.setInput('grade', grade);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('offers only plus and minus in grade 1', async () => {
    const { el } = await render('1');
    expect((el.querySelector('#op-add') as HTMLInputElement).disabled).toBe(false);
    expect((el.querySelector('#op-mul') as HTMLInputElement).disabled).toBe(true);
    expect((el.querySelector('#op-div') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows what will be practiced for the chosen difficulty', async () => {
    const { fixture, el } = await render('3');
    for (const id of ['#op-add', '#op-sub', '#op-div']) (el.querySelector(id) as HTMLInputElement).click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Du übst: Kleines Einmaleins');
    (el.querySelector('#difficulty-hard') as HTMLInputElement).click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Du übst: Zehnereinmaleins');
  });

  it('starts a round with the chosen settings', async () => {
    const { fixture, el } = await render('2');
    (el.querySelector('#difficulty-medium') as HTMLInputElement).click();
    (el.querySelector('#timer-perTask') as HTMLInputElement).click();
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (el.querySelector('.btn-start') as HTMLButtonElement).click();
    const settings = TestBed.inject(QuizSession).settings()!;
    expect(settings).toMatchObject({ grade: 2, mode: 'arithmetic', difficulty: 'medium', timer: { mode: 'perTask', seconds: 15 } });
    expect(navigate).toHaveBeenCalledWith(['/quiz']);
    TestBed.inject(QuizSession).abandon();
  });

  it('handles unknown grades', async () => {
    const { el } = await render('13');
    expect(el.textContent).toContain('Diese Klasse gibt es nicht');
  });
});

describe('QuizPage', () => {
  beforeEach(setup);

  async function renderQuiz() {
    const session = TestBed.inject(QuizSession);
    session.start({ grade: 2, mode: 'arithmetic', operations: ['mul'], topicIds: [], difficulty: 'easy', timer: { mode: 'off' }, taskCount: 3 });
    const fixture = TestBed.createComponent(QuizPage);
    await fixture.whenStable();
    return { fixture, session, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the task with three answers', async () => {
    const { el } = await renderQuiz();
    expect(el.querySelector('.prompt')?.textContent).toContain('=');
    expect(el.querySelectorAll('.choice').length).toBe(3);
    expect(el.textContent).toContain('Aufgabe 1 von 3');
  });

  it('raises no false stuck alarm for quick consecutive correct answers', async () => {
    vi.useFakeTimers();
    try {
      const report = vi.spyOn(TestBed.inject(ClientLogger), 'report').mockImplementation(() => {});
      const session = TestBed.inject(QuizSession);
      session.start({ grade: 2, mode: 'arithmetic', operations: ['mul'], topicIds: [], difficulty: 'easy', timer: { mode: 'off' }, taskCount: 8 });
      const fixture = TestBed.createComponent(QuizPage);
      fixture.detectChanges();
      for (let i = 0; i < 7; i++) {
        session.answer(session.task()!.correctIndex);
        fixture.detectChanges();
        await vi.advanceTimersByTimeAsync(1150); // automatisches Weiter nach 1,1 s
        fixture.detectChanges();
      }
      expect(report).not.toHaveBeenCalledWith('stuck', expect.anything(), expect.anything());
      expect(session.records()).toHaveLength(7);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers with the number keys and explains mistakes', async () => {
    const { fixture, session, el } = await renderQuiz();
    const wrong = ((session.task()!.correctIndex + 1) % 3) + 1;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: String(wrong) }));
    await fixture.whenStable();
    expect(session.phase()).toBe('feedback');
    expect(el.querySelector('.feedback')?.textContent).toContain('Richtig ist');
    expect(el.querySelector('.state-correct')).not.toBeNull();
    expect(el.querySelector('.state-wrong')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(el.textContent).toContain('Aufgabe 2 von 3');
    fixture.destroy();
  });
});

describe('ResultPage', () => {
  beforeEach(setup);

  it('summarizes the round and lists mistakes with the solution', async () => {
    const session = TestBed.inject(QuizSession);
    session.start({ grade: 2, mode: 'arithmetic', operations: ['mul'], topicIds: [], difficulty: 'easy', timer: { mode: 'off' }, taskCount: 2 });
    session.answer(session.task()!.correctIndex);
    session.next();
    session.answer((session.task()!.correctIndex + 1) % 3);
    session.next();
    const fixture = TestBed.createComponent(ResultPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('1/2');
    expect(el.textContent).toContain('50 %');
    expect(el.querySelectorAll('.mistake').length).toBe(1);
    expect(el.querySelector('.new-badges')?.textContent).toContain('Gestartet');
  });

  it('offers the next level after a passed lesson step', async () => {
    const session = TestBed.inject(QuizSession);
    session.start({ grade: 3, mode: 'topics', operations: [], topicIds: ['k3-add-1000'], difficulty: 'easy', timer: { mode: 'off' }, taskCount: 1, lesson: { topicId: 'k3-add-1000', step: 'easy' } });
    session.answer(session.task()!.correctIndex);
    session.next();
    const fixture = TestBed.createComponent(ResultPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Level 1 geschafft · Plus bis 1 000');
    expect(el.textContent).toContain('Weiter zu Level 2');
    expect(el.textContent).toContain('Zur Lektion');
  });
});
