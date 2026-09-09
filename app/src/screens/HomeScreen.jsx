import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell, Avatar, Empty } from '../components/AppShell';
import { POINTS, QUIZ_ORDER, QUIZZES } from '../content/trailContent';
import { useTrail } from '../context/TrailContext';

function Task({ label, description, done, doneLabel, pendingLabel, onClick }) {
  return (
    <button className="action-item" type="button" disabled={done} onClick={onClick}>
      <span className="action-text">
        <span className="label">{label}</span>
        {description && <span className="sub">{description}</span>}
      </span>
      <span className={`status ${done ? 'done' : 'pending'}`}>
        {done ? doneLabel : pendingLabel}
      </span>
    </button>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const {
    progress,
    hostIssue,
    faces,
    loadFaces,
    register,
    checkIn,
    startFeedback,
    startQuiz,
    totalPoints,
  } = useTrail();
  const identity = progress.identity;
  const profile = faces.find((person) => person.key === identity?.username) || identity;

  return (
    <AppShell>
      {hostIssue && (
        <section className="card notice" role="alert">
          <h2>Update needed</h2>
          <p>{hostIssue}</p>
        </section>
      )}
      {!identity ? (
        <section className="card">
          <h3>Get started</h3>
          <p>
            Register, then collect points by checking in, taking the quizzes, and telling us how the
            day went. Your name and selfie appear on the Faces wall for other attendees during the
            event.
          </p>
          <button className="btn btn-primary" type="button" onClick={register}>
            Register
          </button>
        </section>
      ) : (
        <section className="card profile-card">
          <Avatar person={profile} className="profile-avatar" />
          <h3>{identity.name}</h3>
          {identity.favouriteQuote && <p className="profile-quote">“{identity.favouriteQuote}”</p>}
          <p className="profile-status">{totalPoints} points so far</p>
        </section>
      )}
      <h2 className="section-title">Community</h2>
      <CommunityStrip faces={faces} loadFaces={loadFaces} />
      <button className="link-btn" type="button" onClick={() => navigate('/faces')}>
        See everyone →
      </button>
      {identity && (
        <>
          <h2 className="section-title">Today</h2>
          <Task
            label="Check in"
            description={
              !progress.checkedIn &&
              `Tap once you arrive at the venue. Worth ${POINTS.checkin} points.`
            }
            done={progress.checkedIn}
            doneLabel={`+${POINTS.checkin} points`}
            pendingLabel="Tap to check in"
            onClick={checkIn}
          />
          <h2 className="section-title">Quizzes</h2>
          {QUIZ_ORDER.map((quizKey) => {
            const quizProgress = progress.quizzes[quizKey];
            return (
              <Task
                key={quizKey}
                label={QUIZZES[quizKey].title}
                description={
                  !quizProgress?.done && 'A few quick questions. A point for each right answer.'
                }
                done={Boolean(quizProgress?.done)}
                doneLabel={quizProgress ? `${quizProgress.score}/${quizProgress.maxScore}` : ''}
                pendingLabel="Take quiz"
                onClick={() => startQuiz(quizKey)}
              />
            );
          })}
          <h2 className="section-title">Feedback</h2>
          <Task
            label="How was today?"
            description={
              !progress.feedbackDone &&
              `Rate the day and tell us what you think. Worth ${POINTS.feedback} points.`
            }
            done={progress.feedbackDone}
            doneLabel={`+${POINTS.feedback} points`}
            pendingLabel="Share feedback"
            onClick={startFeedback}
          />
        </>
      )}
      <nav className="nav-grid" aria-label="More">
        <Link className="btn btn-outline" to="/agenda">
          Agenda
        </Link>
        <Link className="btn btn-outline" to="/about">
          About ODE
        </Link>
        <Link className="btn btn-outline" to="/leaderboard">
          Leaderboard
        </Link>
        <Link className="btn btn-outline" to="/faces">
          Faces
        </Link>
        <Link className="btn btn-outline" to="/attendance">
          Attendance
        </Link>
      </nav>
    </AppShell>
  );
}

function CommunityStrip({ faces, loadFaces }) {
  useEffect(() => {
    loadFaces().catch(() => undefined);
  }, [loadFaces]);

  const people = faces.filter((person) => person.name);
  if (!people.length) return <Empty>No one else yet — check back soon.</Empty>;
  return (
    <ul className="community-strip">
      {people.map((person) => (
        <li className="community-tile" key={person.key}>
          <Avatar person={person} className="community-avatar" />
        </li>
      ))}
    </ul>
  );
}
