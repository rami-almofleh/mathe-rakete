import { GRADES } from '../models';
import { CHAPTERS, chaptersForGrade, findChapter, findTopic, gradeOf, GRADE_INFO, OTHER_CHAPTER_ID, TOPICS, topicsForGrade, topicsUpToGrade } from './curriculum';
import { STATE_GRADE_OVERRIDES, STATE_OPTIONS } from './states';

describe('curriculum', () => {
  it('has topics and a tagline for every grade', () => {
    for (const grade of GRADES) {
      expect(topicsForGrade(grade).length).toBeGreaterThan(0);
      expect(GRADE_INFO[grade].tagline).toBeTruthy();
    }
  });

  it('uses unique topic ids prefixed with their grade', () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of TOPICS) {
      expect(topic.id.startsWith(`k${topic.grade}-`)).toBe(true);
    }
  });

  it('includes earlier grades for revision', () => {
    const upTo3 = topicsUpToGrade(3);
    expect(upTo3.some((t) => t.grade === 1)).toBe(true);
    expect(upTo3.some((t) => t.grade === 4)).toBe(false);
  });
});

describe('Bereiche (Lektionsliste)', () => {
  it('puts every topic into an existing chapter of its own grade', () => {
    for (const topic of TOPICS) {
      const chapter = findChapter(topic.chapter);
      expect(chapter, `${topic.id}: unbekannter Bereich ${topic.chapter}`).toBeTruthy();
      expect(chapter!.grade, topic.id).toBe(topic.grade);
    }
  });

  it('uses unique chapter ids and no empty chapters', () => {
    const ids = CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const chapter of CHAPTERS) {
      expect(TOPICS.some((t) => t.chapter === chapter.id), chapter.id).toBe(true);
    }
  });

  it('lists every topic of a grade exactly once, in chapter order', () => {
    for (const state of STATE_OPTIONS.map((s) => s.id)) {
      for (const grade of GRADES) {
        const listed = chaptersForGrade(grade, state).flatMap((g) => g.topics.map((t) => t.id));
        expect(listed.sort(), `${state}/${grade}`).toEqual(topicsForGrade(grade, state).map((t) => t.id).sort());
      }
    }
    expect(chaptersForGrade(3).map((g) => g.chapter.title)).toEqual(['Zahlen bis 1 000', 'Plus und Minus bis 1 000', 'Mal und geteilt', 'Größen', 'Geometrie', 'Daten', 'Sachaufgaben']);
  });

  it('moves a topic of another grade into a fitting chapter (Bundesland)', () => {
    // Bayern: Flächen von Dreieck & Co. schon in Kl. 6 → dort unter „Geometrie“
    const geometry = chaptersForGrade(6, 'by').find((g) => g.chapter.id === 'k6-geometrie');
    expect(geometry?.topics.map((t) => t.id)).toContain('k8-areas');
    expect(chaptersForGrade(6, 'by').some((g) => g.chapter.id === OTHER_CHAPTER_ID && g.topics.some((t) => t.id === 'k8-areas'))).toBe(false);
  });
});

describe('Bundesland-Abweichungen (Phase 12)', () => {
  it('lists a state option for every override table and vice versa', () => {
    expect(new Set(STATE_OPTIONS.map((s) => s.id))).toEqual(new Set(Object.keys(STATE_GRADE_OVERRIDES)));
  });

  it('only overrides topics that really exist, with a valid grade', () => {
    for (const [state, overrides] of Object.entries(STATE_GRADE_OVERRIDES)) {
      for (const [topicId, grade] of Object.entries(overrides)) {
        const topic = findTopic(topicId);
        expect(topic, `${state}: unbekanntes Thema ${topicId}`).toBeTruthy();
        expect(GRADES, `${state}/${topicId}: Klasse ${grade} ungültig`).toContain(grade);
      }
    }
  });

  it('changes at least one topic for every non-default state (research was not a no-op)', () => {
    for (const state of STATE_OPTIONS.map((s) => s.id).filter((id) => id !== 'de')) {
      expect(Object.keys(STATE_GRADE_OVERRIDES[state]).length, state).toBeGreaterThan(0);
    }
  });

  it('moves a topic to the overridden grade and leaves it out of the old one', () => {
    // Bayern: negative Zahlen schon in Kl. 5 statt Kl. 7
    expect(gradeOf(findTopic('k7-integers')!, 'by')).toBe(5);
    expect(topicsForGrade(5, 'by').map((t) => t.id)).toContain('k7-integers');
    expect(topicsForGrade(7, 'by').map((t) => t.id)).not.toContain('k7-integers');
    // ohne Bundesland (Standard) bleibt es bei Kl. 7
    expect(gradeOf(findTopic('k7-integers')!, 'de')).toBe(7);
  });

  it('still counts an overridden topic for revision up to its new grade', () => {
    // NRW: schriftliche Division rückt von Kl. 4 auf Kl. 5
    expect(topicsUpToGrade(4, 'nw').map((t) => t.id)).not.toContain('k4-written-div');
    expect(topicsUpToGrade(5, 'nw').map((t) => t.id)).toContain('k4-written-div');
  });
});
