import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiClient } from '../core/auth/api-client';
import { FakeApiClient } from '../core/testing/fake-api-client';
import { QuizSession } from '../core/quiz/quiz-session';
import { HomePage } from './home/home-page';
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
});
