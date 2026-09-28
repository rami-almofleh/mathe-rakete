import { GRADES } from '../models';
import { findTopic, gradeOf, GRADE_INFO, TOPICS, topicsForGrade, topicsUpToGrade } from './curriculum';
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
