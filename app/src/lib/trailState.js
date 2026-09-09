import { POINTS, QUIZ_ORDER, QUIZZES } from '../content/trailContent.js';

const STORAGE_KEY = 'odeTrail.v1';

export function defaultProgress() {
  return { identity: null, checkedIn: false, quizzes: {}, feedbackDone: false };
}

export function loadProgress() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultProgress(), ...JSON.parse(stored) } : defaultProgress();
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Observations remain canonical when local storage is unavailable.
  }
}

export function observationTime(observation, field = 'updatedAt') {
  const value = observation?.[field] || observation?.createdAt || 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function personKey(data) {
  return data?.username || data?.name || '';
}

export function quizKeyForFormType(formType) {
  return QUIZ_ORDER.find((quizKey) => QUIZZES[quizKey].formType === formType) || null;
}

export function scoreQuiz(quizKey, data) {
  const quiz = QUIZZES[quizKey];
  return quiz.questions.reduce(
    (score, question) => score + Number(data?.[question] === quiz.answers[question]),
    0
  );
}

export function scoreFromObservation(quizKey, data) {
  const hasAnswers = QUIZZES[quizKey].questions.some((question) => data?.[question] !== undefined);
  return hasAnswers ? scoreQuiz(quizKey, data) : typeof data?.score === 'number' ? data.score : 0;
}

export function totalPoints(progress) {
  let total =
    Number(progress.checkedIn) * POINTS.checkin + Number(progress.feedbackDone) * POINTS.feedback;
  QUIZ_ORDER.forEach((quizKey) => {
    total += progress.quizzes[quizKey]?.done ? progress.quizzes[quizKey].score : 0;
  });
  return total;
}

export function isSubmitted(result) {
  return result?.status === 'form_submitted' || result?.status === 'form_updated';
}
