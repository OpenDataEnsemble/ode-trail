import { AGENDA, ABOUT_ODE } from '../content/trailContent';
import { AppShell } from '../components/AppShell';

export function AgendaScreen() {
  return (
    <AppShell title="Agenda" back>
      <div className="card">
        {AGENDA.map((item) => (
          <div className="agenda-item" key={item.time}>
            <div className="agenda-time">{item.time}</div>
            <div className="agenda-title">{item.title}</div>
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
