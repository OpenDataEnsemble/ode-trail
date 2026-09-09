import { useEffect, useState } from 'react';
import { AppShell, Avatar, Empty } from '../components/AppShell';
import { QUIZ_ORDER, QUIZZES } from '../content/trailContent';
import { useTrail } from '../context/TrailContext';
import { getFormulus } from '../lib/formulus';
import {
  observationTime,
  personKey,
  quizKeyForFormType,
  scoreFromObservation,
} from '../lib/trailState';

export function FacesScreen() {
  const { faces, loadFaces } = useTrail();
  const [error, setError] = useState(false);
  useEffect(() => {
    loadFaces().catch(() => setError(true));
  }, [loadFaces]);
  const people = faces.filter((person) => person.name);
  return (
    <AppShell title="Faces" back>
      <section className="card">
        <p>
          Everyone who has registered. Anyone whose selfie hasn’t synced to this device yet shows up
          as an initial for now — sync from the Sync tab to fill it in.
        </p>
      </section>
      <section className="card">
        {error ? (
          <Empty>{'Couldn’t load the photo wall.'}</Empty>
        ) : !people.length ? (
          <Empty>No faces yet — be the first to register.</Empty>
        ) : (
          <ul className="faces-grid">
            {people.map((person) => (
              <li className="face-tile" key={person.key}>
                <Avatar person={person} className="face-avatar" />
                <span className="face-name">{person.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function rankRows(rows) {
  return rows.sort(
    (left, right) =>
      right.score - left.score || left.at - right.at || left.name.localeCompare(right.name)
  );
}

async function loadBoard() {
  const api = await getFormulus();
  const forms = ['checkin', 'feedback', ...QUIZ_ORDER.map((key) => QUIZZES[key].formType)];
  const [registrations, ...results] = await Promise.all([
    api.getObservationsByQuery({ formType: 'register' }).catch(() => []),
    ...forms.map((formType) => api.getObservationsByQuery({ formType }).catch(() => [])),
  ]);
  const profiles = new Map();
  await Promise.all(
    registrations.map(async (observation) => {
      const key = personKey(observation.data);
      if (!key || profiles.has(key)) return;
      const data = observation.data || {};
      const uri = data.selfie?.filename
        ? await api.getAttachmentUri(data.selfie.filename).catch(() => null)
        : null;
      profiles.set(key, { name: data.name || key, uri });
    })
  );
  const people = new Map();
  const quizzes = new Map(QUIZ_ORDER.map((key) => [key, []]));
  results.forEach((observations, index) => {
    const formType = forms[index];
    const first = new Map();
    observations.forEach((observation) => {
      const key = personKey(observation.data);
      const current = first.get(key);
      if (
        !key ||
        (current &&
          observationTime(observation, 'createdAt') >= observationTime(current, 'createdAt'))
      )
        return;
      first.set(key, observation);
    });
    first.forEach((observation, key) => {
      const data = observation.data || {};
      const quizKey = quizKeyForFormType(formType);
      const score = quizKey
        ? scoreFromObservation(quizKey, data)
        : formType === 'checkin' || formType === 'feedback'
          ? 2
          : 0;
      const profile = profiles.get(key);
      const row = people.get(key) || {
        key,
        name: profile?.name || data.name || key,
        uri: profile?.uri || null,
        score: 0,
        at: 0,
      };
      row.score += score;
      row.at = Math.max(row.at, observationTime(observation, 'createdAt'));
      people.set(key, row);
      if (quizKey && score > 0)
        quizzes.get(quizKey).push({ ...row, score, at: observationTime(observation, 'createdAt') });
    });
  });
  const ranked = rankRows([...people.values()]);
  return {
    ranked: ranked.slice(0, 10),
    rest: ranked.slice(10).sort((left, right) => left.name.localeCompare(right.name)),
    quizzes: QUIZ_ORDER.map((key) => ({
      title: QUIZZES[key].title,
      winners: rankRows(quizzes.get(key)).slice(0, 3),
    })).filter((board) => board.winners.length),
  };
}

export function LeaderboardScreen() {
  const { progress } = useTrail();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadBoard()
      .then(setBoard)
      .catch(() => setError(true));
  }, []);
  const mine = progress.identity?.username || progress.identity?.name;
  return (
    <AppShell title="Leaderboard" back>
      <section className="card">
        <p>
          Medals go to the top three overall and to the top three in each quiz. Points come from
          checking in, from every right answer, and from leaving feedback — so the overall winner is
          settled once the feedback is in. Your first attempt at a quiz is the one that counts, and
          equal points are split by whoever got there first.
        </p>
        <p>Everyone appears once their answers have synced — sync from the Sync tab to refresh.</p>
      </section>
      <section className="card">
        {error ? (
          <Empty>{'Couldn’t load the leaderboard.'}</Empty>
        ) : !board ? (
          <Empty />
        ) : (
          <Boards board={board} mine={mine} />
        )}
      </section>
    </AppShell>
  );
}

function Boards({ board, mine }) {
  if (!board.ranked.length) return <Empty>No points yet — be the first.</Empty>;
  return (
    <>
      <h3 className="lb-subhead lb-subhead-first">Overall</h3>
      <Board rows={board.ranked} mine={mine} ranked />
      {board.rest.length > 0 && (
        <>
          <h3 className="lb-subhead">Everyone else, A to Z</h3>
          <Board rows={board.rest} mine={mine} />
        </>
      )}
      {board.quizzes.map((quiz) => (
        <section key={quiz.title}>
          <h3 className="lb-subhead">{quiz.title}</h3>
          <Board rows={quiz.winners} mine={mine} ranked />
        </section>
      ))}
    </>
  );
}

function Board({ rows, mine, ranked = false }) {
  return (
    <ol className="leaderboard">
      {rows.map((row, index) => {
        const rank = ranked ? index + 1 : null;
        return (
          <li
            className={`leaderboard-row ${rank && rank <= 3 ? `podium rank-${rank}` : ''} ${row.key === mine ? 'me' : ''}`}
            key={row.key}
          >
            <span className="lb-rank">{rank || ''}</span>
            <Avatar person={row} className="lb-avatar" />
            <span className="leaderboard-name">
              <span className="lb-name-text">{row.name}</span>
              {row.key === mine && <span className="you-tag">You</span>}
            </span>
            <span className="leaderboard-score">{row.score}</span>
          </li>
        );
      })}
    </ol>
  );
}
