import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFromObservation, scoreQuiz, totalPoints } from './trailState.js';

test('scores quiz answers from the canonical answer fields', () => {
  assert.equal(
    scoreQuiz('quiz_open_source', {
      q1: 'anyone_can_view',
      q2: 'contribute_changes',
      q3: 'wrong',
      q4: 'mit',
    }),
    3
  );
});

test('uses a persisted score only for legacy observations without answers', () => {
  assert.equal(scoreFromObservation('quiz_about_ode', { score: 4 }), 4);
  assert.equal(scoreFromObservation('quiz_about_ode', { q1: 'wrong', score: 4 }), 0);
});

test('adds fixed awards and completed quiz scores', () => {
  assert.equal(
    totalPoints({
      checkedIn: true,
      feedbackDone: true,
      quizzes: { quiz_open_source: { done: true, score: 3 } },
    }),
    7
  );
});
