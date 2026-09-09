import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { QUIZ_ORDER, QUIZZES } from '../content/trailContent';
import { getFormulus, hostVersionIssue } from '../lib/formulus';
import {
  defaultProgress,
  isSubmitted,
  loadProgress,
  observationTime,
  personKey,
  quizKeyForFormType,
  scoreFromObservation,
  scoreQuiz,
  saveProgress,
  totalPoints,
} from '../lib/trailState';

const TrailContext = createContext(null);

function firstForUsername(observations, username) {
  return observations.find((observation) => observation.data?.username === username) || null;
}

export function TrailProvider({ children }) {
  const [progress, setProgress] = useState(loadProgress);
  const [hostIssue, setHostIssue] = useState(null);
  const [notice, setNotice] = useState(null);
  const [faces, setFaces] = useState([]);
  const actionInFlight = useRef(false);
  const facesCache = useRef(null);

  const updateProgress = useCallback((updater) => {
    setProgress((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      saveProgress(next);
      return next;
    });
  }, []);

  const showError = useCallback((prefix, error) => {
    setNotice(`${prefix}${error?.message ? `: ${error.message}` : '. Try again.'}`);
  }, []);

  const loadFaces = useCallback(async (force = false) => {
    if (!force && facesCache.current && Date.now() - facesCache.current.at < 30000) {
      setFaces(facesCache.current.people);
      return facesCache.current.people;
    }

    const api = await getFormulus();
    const observations = await api.getObservationsByQuery({ formType: 'register' }).catch(() => []);
    const newestByPerson = new Map();
    observations.forEach((observation) => {
      const key = personKey(observation.data);
      if (!key || observationTime(observation) < observationTime(newestByPerson.get(key))) return;
      newestByPerson.set(key, observation);
    });

    const people = await Promise.all(
      [...newestByPerson].map(async ([key, observation]) => {
        const data = observation.data || {};
        const filename = data.selfie?.filename;
        let uri = null;
        if (filename) uri = await api.getAttachmentUri(filename).catch(() => null);
        return { key, name: data.name || key, uri };
      })
    );
    facesCache.current = { at: Date.now(), people };
    setFaces(people);
    return people;
  }, []);

  const hydrateProgress = useCallback(async () => {
    const username = progress.identity?.username;
    if (!username) return;
    const api = await getFormulus();
    const formTypes = ['checkin', 'feedback', ...QUIZ_ORDER.map((key) => QUIZZES[key].formType)];
    const results = await Promise.all(
      formTypes.map(async (formType) => ({
        formType,
        observations: await api.getObservationsByQuery({ formType }).catch(() => []),
      }))
    );

    updateProgress((current) => {
      if (current.identity?.username !== username) return current;
      const next = { ...current, quizzes: { ...current.quizzes } };
      let changed = false;
      results.forEach(({ formType, observations }) => {
        const mine = observations.filter((observation) => observation.data?.username === username);
        if (!mine.length) return;
        if (formType === 'checkin') {
          changed ||= !next.checkedIn;
          next.checkedIn = true;
        } else if (formType === 'feedback') {
          changed ||= !next.feedbackDone;
          next.feedbackDone = true;
        } else {
          const quizKey = quizKeyForFormType(formType);
          const latest = mine.reduce((newest, observation) =>
            !newest || observationTime(observation) >= observationTime(newest)
              ? observation
              : newest
          );
          const score = scoreFromObservation(quizKey, latest.data);
          const maxScore = QUIZZES[quizKey].questions.length;
          changed ||= !next.quizzes[quizKey]?.done || next.quizzes[quizKey]?.score !== score;
          next.quizzes[quizKey] = { done: true, score, maxScore };
        }
      });
      return changed ? next : current;
    });
  }, [progress.identity?.username, updateProgress]);

  const refreshSession = useCallback(async () => {
    const api = await getFormulus();
    const user = await api.getCurrentUser();
    const username = user?.username || '';
    let activeIdentity = progress.identity;

    if (activeIdentity?.username && username && activeIdentity.username !== username) {
      activeIdentity = null;
      updateProgress(defaultProgress());
      facesCache.current = null;
      setNotice("You're signed in as a different user — please register again.");
    }

    if (!activeIdentity && username) {
      const registrations = await api
        .getObservationsByQuery({ formType: 'register' })
        .catch(() => []);
      const registration = firstForUsername(registrations, username);
      if (registration) {
        const data = registration.data || {};
        activeIdentity = {
          name: data.name || '',
          favouriteQuote: data.favouriteQuote || '',
          selfie: data.selfie || null,
          username,
          observationId: registration.observationId,
        };
        updateProgress((current) => ({ ...current, identity: activeIdentity }));
      }
    }

    if (activeIdentity?.username) await hydrateProgress();
  }, [hydrateProgress, progress.identity, updateProgress]);

  useEffect(() => {
    let active = true;
    getFormulus()
      .then(async (api) => {
        const issue = await hostVersionIssue(api);
        if (active) setHostIssue(issue);
        return refreshSession();
      })
      .catch(() => active && setNotice('Open this app inside Formulus to use it.'));
    return () => {
      active = false;
    };
  }, [refreshSession]);

  useEffect(() => {
    const previous = window.onReceiveFocus;
    window.onReceiveFocus = () => {
      if (typeof previous === 'function') previous();
      facesCache.current = null;
      return refreshSession().catch(() => undefined);
    };
    return () => {
      window.onReceiveFocus = previous;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const runExclusive = useCallback(async (action) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      await action();
    } finally {
      actionInFlight.current = false;
    }
  }, []);

  const requireReady = useCallback(
    (needsIdentity) => {
      if (hostIssue) {
        setNotice(hostIssue);
        return false;
      }
      if (needsIdentity && !progress.identity) {
        setNotice('Register first to unlock the rest of the trail.');
        return false;
      }
      return true;
    },
    [hostIssue, progress.identity]
  );

  const identityStamp = useCallback(
    (timestampKey) => ({
      name: progress.identity?.name || '',
      username: progress.identity?.username || '',
      [timestampKey]: new Date().toISOString(),
    }),
    [progress.identity]
  );

  const alreadySubmitted = useCallback(
    async (api, formType) => {
      const username = progress.identity?.username;
      if (!username) return false;
      const observations = await api.getObservationsByQuery({ formType }).catch(() => []);
      return observations.some((observation) => observation.data?.username === username);
    },
    [progress.identity?.username]
  );

  const register = useCallback(() => {
    if (!requireReady(false)) return;
    runExclusive(async () => {
      try {
        const api = await getFormulus();
        const user = await api.getCurrentUser();
        const username = user?.username || '';
        if (!username) {
          setNotice('Sign in to Formulus before registering.');
          return;
        }
        const displayName = user.displayName || username;
        const registrations = await api
          .getObservationsByQuery({ formType: 'register' })
          .catch(() => []);
        const existing = firstForUsername(registrations, username);
        if (existing) {
          const data = existing.data || {};
          updateProgress((current) => ({
            ...current,
            identity: {
              name: data.name || displayName,
              favouriteQuote: data.favouriteQuote || '',
              selfie: data.selfie || null,
              username,
              observationId: existing.observationId,
            },
          }));
          setNotice(`You're already registered as ${data.name || 'a returning attendee'}.`);
          await hydrateProgress();
          return;
        }
        const result = await api.openFormplayer(
          'register',
          { defaultData: { name: displayName, username, registered_at: new Date().toISOString() } },
          {}
        );
        if (!isSubmitted(result)) return;
        const data = result.formData || {};
        updateProgress((current) => ({
          ...current,
          identity: {
            name: data.name || displayName,
            favouriteQuote: data.favouriteQuote || '',
            selfie: data.selfie || null,
            username: data.username || username,
            observationId: result.observationId || null,
          },
        }));
        facesCache.current = null;
        setNotice(`Thank you for registering, ${data.name || displayName}!`);
      } catch (error) {
        showError("Couldn't open the registration form", error);
      }
    });
  }, [hydrateProgress, requireReady, runExclusive, showError, updateProgress]);

  const openOneTimeForm = useCallback(
    (formType, timestampKey, complete) => {
      if (!requireReady(true)) return;
      runExclusive(async () => {
        try {
          const api = await getFormulus();
          if (await alreadySubmitted(api, formType)) {
            updateProgress((current) => ({ ...current, ...complete(current, true) }));
            setNotice(
              formType === 'checkin'
                ? "You're already checked in."
                : "You've already shared your feedback — thank you."
            );
            return;
          }
          const result = await api.openFormplayer(
            formType,
            { defaultData: identityStamp(timestampKey) },
            {}
          );
          if (!isSubmitted(result)) return;
          updateProgress((current) => ({ ...current, ...complete(current, false) }));
          setNotice(
            formType === 'checkin'
              ? `Welcome to the ODE Community, ${progress.identity.name}!`
              : 'Thanks for the feedback!'
          );
        } catch (error) {
          showError(
            `Couldn't open ${formType === 'checkin' ? 'check-in' : 'the feedback form'}`,
            error
          );
        }
      });
    },
    [
      alreadySubmitted,
      identityStamp,
      progress.identity?.name,
      requireReady,
      runExclusive,
      showError,
      updateProgress,
    ]
  );

  const checkIn = useCallback(
    () => openOneTimeForm('checkin', 'checked_in_at', () => ({ checkedIn: true })),
    [openOneTimeForm]
  );
  const startFeedback = useCallback(
    () => openOneTimeForm('feedback', 'submitted_at', () => ({ feedbackDone: true })),
    [openOneTimeForm]
  );

  const startQuiz = useCallback(
    (quizKey) => {
      if (!requireReady(true)) return;
      runExclusive(async () => {
        const quiz = QUIZZES[quizKey];
        try {
          const api = await getFormulus();
          if (await alreadySubmitted(api, quiz.formType)) {
            setNotice("You've already taken that quiz — your first result counts.");
            await hydrateProgress();
            return;
          }
          const result = await api.openFormplayer(
            quiz.formType,
            { defaultData: identityStamp('answered_at') },
            {}
          );
          if (!isSubmitted(result)) return;
          const score = scoreQuiz(quizKey, result.formData);
          const maxScore = quiz.questions.length;
          updateProgress((current) => ({
            ...current,
            quizzes: { ...current.quizzes, [quizKey]: { done: true, score, maxScore } },
          }));
          setNotice(`Scored ${score}/${maxScore} — nice.`);
          if (result.observationId) {
            await api
              .persistObservation({
                formType: quiz.formType,
                observationId: result.observationId,
                finalData: { ...result.formData, score, max_score: maxScore },
              })
              .catch(() => undefined);
          }
        } catch (error) {
          showError("Couldn't open that quiz", error);
        }
      });
    },
    [
      alreadySubmitted,
      hydrateProgress,
      identityStamp,
      requireReady,
      runExclusive,
      showError,
      updateProgress,
    ]
  );

  return (
    <TrailContext.Provider
      value={{
        progress,
        hostIssue,
        notice,
        faces,
        loadFaces,
        register,
        checkIn,
        startFeedback,
        startQuiz,
        totalPoints: totalPoints(progress),
      }}
    >
      {children}
    </TrailContext.Provider>
  );
}

export function useTrail() {
  const context = useContext(TrailContext);
  if (!context) throw new Error('useTrail must be used inside TrailProvider.');
  return context;
}
