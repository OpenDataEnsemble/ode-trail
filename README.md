# ODE Trail

[![License: MIT](https://img.shields.io/badge/License-MIT-0E4B23.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-F2A81D.svg)](CONTRIBUTING.md)

A small **React** custom app for an Open Data Ensemble Community Day. Attendees register with a selfie, check in, take two quizzes, and leave feedback—offline first in Formulus. A leaderboard and photo wall are reconstructed from synced observations.

The Attendance wall is different by design: it is release content in this repository. Attendees add their name through a pull request, and it appears after the next bundle is published.

## Architecture

React owns the app shell, routes, and event UI. Formplayer continues to render all data-entry forms from the JSON authored in `forms/`.

```text
app/                         # npm root and Vite application
  public/
    app.config.json          # Formulus chrome configuration
    formulus-load.js         # bridge bootstrap; loaded before React
  src/
    content/                 # editable agenda, ODE copy, attendance list
    context/TrailContext.jsx # bridge-backed event state and actions
    screens/                 # six small route screens
    lib/                     # bridge, scoring, and local cache helpers
  scripts/                   # form copy, validation, staging, ZIP build
forms/<formType>/            # authored JSON Form schemas and UI schemas
app-bundles/                 # generated staging directory and ZIP (ignored)
```

The generated `app/public/forms/` directory is runtime build output. Edit the source forms in repo-root `forms/`, never the generated copy.

## Requirements

| Requirement | Why |
| --- | --- |
| Formulus 1.3.0+ | `persistObservation` stamps completed quiz scores. |
| Node.js 18+ | React/Vite build and validation tooling. |
| Synkronus admin credentials | Required only to publish a bundle. |

The app needs Formulus (or ODE Desktop Workbench) to perform registrations and queries. In a regular browser, static routes still load but bridge-backed features show an availability message.

## Local development and build

Run these from `app/`:

```bash
npm install
npm run dev              # copy forms, then start Vite
npm run validate:forms   # schema and UI scope checks
npm run lint
npm run test
npm run format:check
npm run build            # Vite build → app-bundles/app
npm run zip              # app-bundles/bundle-v<package-version>.zip
```

Convenience commands are also available from the repository root, for example `npm run build` and `npm run zip`.

The bundle ZIP has the ODE-required `app/` prefix and includes `index.html`, `app.config.json`, compiled assets, and copied forms. Its filename comes from `app/package.json`; keep that version aligned with `app/public/app.config.json` before a release.

## Contributing

Community Day attendees should start with [CONTRIBUTING.md](CONTRIBUTING.md). To sign the Attendance wall, edit `app/src/content/attendees.js` under the comment for the first letter of your name, then open a pull request.

## License

[MIT](LICENSE) © Open Data Ensemble
