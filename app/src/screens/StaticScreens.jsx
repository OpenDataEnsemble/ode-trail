import { AGENDA, ABOUT_ODE, REPO_URL } from '../content/trailContent';
import { attendees } from '../content/attendees';
import { AppShell, Empty } from '../components/AppShell';

export function AgendaScreen() {
  return (
    <AppShell title="Agenda" back>
      <div className="card">
        {AGENDA.map((item) => (
          <div className="agenda-item" key={item.time}>
            <div className="agenda-time">{item.time}</div>
            <div>
              <div className="agenda-title">{item.title}</div>
              <div className="agenda-desc">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export function AboutScreen() {
  return (
    <AppShell title="About ODE" back>
      {ABOUT_ODE.map((item) => (
        <section className="card" key={item.title}>
          <h2>{item.title}</h2>
          <p>{item.body}</p>
        </section>
      ))}
    </AppShell>
  );
}

export function AttendanceScreen() {
  const people = attendees
    .filter((person) => person?.name)
    .sort((left, right) => left.name.localeCompare(right.name));
  return (
    <AppShell title="Attendance" back>
      <section className="card">
        <h2>Sign the wall with a pull request</h2>
        <p>
          Every other list in this app is built from forms. This one is built from the repository
          itself — you put yourself on it by opening a pull request.
        </p>
        <p className="repo-url">{REPO_URL}</p>
        <ol className="steps">
          <li>Fork the repository above to your own GitHub account.</li>
          <li>Clone your fork and make a branch.</li>
          <li>
            Add your name to <code>app/src/content/attendees.js</code>, under the comment for your
            first letter.
          </li>
          <li>Commit, push, and open a pull request.</li>
        </ol>
        <p>
          Never done this before? <code>CONTRIBUTING.md</code> walks through every step, including
          setup and what to do when something goes wrong.
        </p>
        <p>
          A host reviews and merges it, then publishes a new app bundle. Your name appears here on
          every phone at the next sync — an open source contribution, end to end.
        </p>
      </section>
      <section className="card">
        {people.length ? (
          <ul className="attendee-list">
            {people.map((person) => (
              <li className="attendee" key={`${person.name}-${person.github || ''}`}>
                <span className="attendee-name">{person.name}</span>
                {person.github && <span className="attendee-handle">@{person.github}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No one has signed the wall yet — be the first pull request.</Empty>
        )}
      </section>
    </AppShell>
  );
}
