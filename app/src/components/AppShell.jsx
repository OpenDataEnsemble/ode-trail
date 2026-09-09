import { useNavigate } from 'react-router-dom';

export function AppShell({ title = 'Open Data Ensemble Community Day', children, back = false }) {
  const navigate = useNavigate();
  return (
    <>
      <header className="header">
        {back && (
          <button className="icon-btn" type="button" aria-label="Back" onClick={() => navigate(-1)}>
            ‹
          </button>
        )}
        <img src="assets/ode-logo.png" alt="ODE" width="44" height="44" decoding="async" />
        <div className="header-text">
          <h1>ODE Trail</h1>
          <p>{title}</p>
        </div>
      </header>
      {children}
    </>
  );
}

export function Avatar({ person, className = '' }) {
  const initial = (person?.name || '?').charAt(0).toUpperCase();
  return person?.uri ? (
    <img className={className} src={person.uri} alt={person.name} loading="lazy" decoding="async" />
  ) : (
    <span
      className={`${className} avatar-placeholder`}
      aria-label={person?.name || 'Photo unavailable'}
    >
      {initial}
    </span>
  );
}

export function Empty({ children = 'Loading…' }) {
  return (
    <div className="empty" role="status">
      {children}
    </div>
  );
}
