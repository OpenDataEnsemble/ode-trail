# ODE Trail

[![License: MIT](https://img.shields.io/badge/License-MIT-0E4B23.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-F2A81D.svg)](CONTRIBUTING.md)

A small app for **Open Data Ensemble Community Day**. Attendees register with a selfie,
check in at the venue, take two short quizzes, and leave feedback — all of it working with
no internet at all. A leaderboard and a photo wall are built from what everyone syncs.

It also has an **Attendance wall**, which is the unusual part: that list is not collected by
a form. It lives in this repository, and attendees put themselves on it by opening a pull
request. Once it is merged and a new release goes out, the name appears inside the app on
every phone in the room. The app is a working demonstration of the open source loop it is
teaching.

---

## 👋 Here for Community Day? Add your name

Your first task is to get your own name onto the Attendance wall: fork this repository,
clone it, make a branch, and open a pull request. Never done that before? Good — the guide
assumes exactly that and walks every step, from installing git to fixing a merge conflict.

**→ [Start here: CONTRIBUTING.md](CONTRIBUTING.md)**

**Save yourself time and do this before the session:** install
[git](https://git-scm.com/downloads), set `git config --global user.name` and `user.email`,
and sign in with [`gh auth login`](https://cli.github.com/). Authentication is where nearly
everyone gets stuck, because GitHub no longer accepts your account password on the command
line.

If you get properly stuck, ask a host — and if all else fails, [open an issue][add-me] and a
maintainer will add you. No one gets left off the wall.

[add-me]: https://github.com/OpenDataEnsemble/ode-trail/issues/new?template=add-me-to-the-wall.md

---

## What it's built with

Plain HTML, CSS, and JavaScript — no framework, no build step, no npm dependencies. That
constraint is deliberate: you can read [`app/app.js`](app/app.js) from top to bottom and
understand the entire app. It runs inside [Formulus][formulus], the offline-first mobile
runtime from [Open Data Ensemble][ode], and syncs to a Synkronus server.

[formulus]: https://opendataensemble.org/docs/
[ode]: https://opendataensemble.org/

## Requirements

| Requirement | Why |
| --- | --- |
| **Formulus 1.3.0 or newer** | `persistObservation` (used to stamp quiz scores) is `@since 1.3.0`. The app checks `getVersion()` at startup and shows a blocking notice on older hosts. |
| Node.js 18+ | Only for the bundle and validation scripts. |
| Synkronus with admin credentials | To upload the app bundle. |

The app only works **inside Formulus** (or the ODE Desktop workbench). Opened in a plain
browser it will report that the Formulus bridge is unavailable.

## Layout

```
app/                       # everything served to the WebView
  index.html               # entry point (required by Synkronus at app/index.html)
  app.js                   # all app logic
  attendees.js             # the Attendance wall — edited by pull request, not by a form
  formulus-load.js         # getFormulus() bridge loader
  style.css
  app.config.json          # name, version, light/dark theme for Formulus chrome
  assets/
forms/<formType>/          # one folder per form type
  schema.json              # JSON Schema draft-07
  ui.json                  # JSON Forms UI schema
scripts/
  validate-forms.js        # structural checks on forms/
  build-bundle.js          # zips app/ + forms/ into app-bundles/
```

## Build

```bash
npm run validate      # structural checks only
npm run bundle        # validate, then write app-bundles/bundle-v<version>.zip
```

Or without npm:

```bash
node scripts/validate-forms.js
node scripts/build-bundle.js
```

The zip is named from `version` in `app/app.config.json`. Bump that (and `package.json`,
which is kept in step manually) before building a release.

`app-bundles/` is gitignored and never committed. Build output does not belong in the
repository — run the script when you need a zip.

## Publish

Upload the zip from `app-bundles/` to your Synkronus server, then ask the room to sync from
the Formulus **Sync** tab. Devices pick up the new bundle on their next sync.

## Contributing

Everyone is welcome, especially if this would be your first open source contribution —
see [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Open Data Ensemble
