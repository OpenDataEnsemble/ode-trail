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
app-bundles/               # build output
```

`build-bundle.js` stages the forms under `app/forms/<formType>/` inside the zip. Both that
layout and a root-level `forms/` are accepted by Synkronus.

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

## Publish

```bash
synk config init
synk login
synk appbundle upload app-bundles/bundle-v1.0.0.zip
```

Stage first if you want to review before switching devices over:

```bash
synk appbundle upload --stage-only app-bundles/bundle-v1.0.0.zip
synk appbundle switch <version>
```

Note: `synk --verbose` may report **Forms: 0** for this bundle. The CLI's local validator
only recognises a root-level `forms/` directory, while the server accepts `app/forms/`.
Confirm the upload from the server response, not the CLI form count.

## Local iteration with ODE Desktop

Developer mode expects `index.html` at the root of the folder you select, so point it at
`ode-trail/app`, **not** the repository root. Form edits under `forms/` are not mirrored
automatically with this layout — rebuild and re-upload the bundle, or edit against a
synced bundle, when changing schemas.

## How identity and progress work

- The signed-in Formulus account is the identity. `getCurrentUser()` supplies both the
  display name and the `username`; the app never asks anyone to type their name.
- Registration is refused when no one is signed in, because `username` is the key that
  every later lookup depends on.
- Every form stores `name` and `username`. These are schema properties with **no Control**
  in `ui.json`, so Formplayer keeps them from `params.defaultData` and writes them on
  submit. Do not add visibility rules to them — clear-on-hide would wipe the stamp.
- Every form also carries an ISO 8601 timestamp (`registered_at`, `checked_in_at`,
  `answered_at`, `submitted_at`), so the day reads as a timeline rather than an
  undated pile of records. It is stamped twice over: the app passes it in
  `defaultData`, and each schema declares `"format": "date-time"` with
  `"default": "$now"`, which Formplayer resolves for a new observation and never
  uses to overwrite a value the app already supplied. The `$now` half is what keeps
  the stamp when someone opens a form straight from the Formulus forms list instead
  of through ODE Trail.
- `localStorage` (`odeTrail.v1`) is a cache, not the source of truth. On launch and on
  every refocus, `hydrateProgress()` rebuilds check-in, quiz, and feedback state from this
  account's own observations, so a cleared cache or a second device still shows the right
  progress.
- Switching Formulus accounts and returning to the app clears the cached identity and
  re-adopts the new account's registration, via `window.onReceiveFocus`.
## Points and the leaderboard

| Action | Points |
| --- | --- |
| Check in | 2 |
| Each correct quiz answer | 1 (so 4 per quiz, 8 across both) |
| Leave feedback | 2 |
| **Total on offer** | **12** |

Registering earns nothing on its own — it is the gate to everything else.

The board is keyed on `username` and counts the **first** submission per person per form.
A retake therefore cannot change anyone's standing, which matters because the Formulus
**Forms** tab stays visible and can open any of these forms directly. Ordering by first
submission is why scoring reads `createdAt` rather than `updatedAt`: stamping a quiz score
with `persistObservation` bumps `updatedAt`, which would make a first attempt look like the
most recent one.

Forms opened from the Forms tab rather than through ODE Trail carry no `name` or
`username`, so they are skipped by both the leaderboard and `hydrateProgress()`. They
cannot affect anyone's score, but they do land in the export as unattributed rows.

The screen shows three things: the **overall** board, with medals for the top three, ranks
down to tenth, and everyone below that listed alphabetically without a rank; a **top three
per quiz**; and, because feedback is worth points, an overall winner that is only settled
once the feedback is in. Equal points are separated by whoever got there first.

Each action is also guarded before it opens: `alreadySubmitted()` checks the stored
observations rather than trusting the cached progress, so a cleared cache, a second device,
or a tap that lands before `hydrateProgress()` returns cannot file a second submission.

## The Attendance wall (maintainer notes)

Contributor-facing instructions live in [CONTRIBUTING.md](CONTRIBUTING.md); this section is
about running it.

`app/attendees.js` is the one list in the app that does not come from a form or the server.
`name` is required, `github` is optional, and anything without a `name` is skipped at render
time — so a malformed entry degrades rather than breaking the screen.

The array is divided by letter-group comments (`// --- A-C ---` and so on). That is not
decoration: without it every contributor inserts at the same line, the first pull request
merges and every other one conflicts. Spreading insertions across eight anchors means most
of them merge cleanly even when dozens arrive at once. Keep the anchors, and keep asking
people to file under their first letter.

Running it on the day:

- Merge in small batches and promptly. A queue is what creates conflicts.
- Use **squash merge** so each name is one tidy commit.
- If a contributor's branch conflicts, fix it on their branch yourself rather than sending
  them round again — "Allow edits by maintainers" is on by default for forks.
- After each batch: `npm run bundle`, upload, and tell the room to sync.
- Watch the `attendance` issue label for anyone who could not manage a pull request.

## Event-day runbook

1. Upload the bundle and confirm devices have pulled it.
2. Each attendee signs into Formulus **before** opening ODE Trail.
3. Register (selfie required), then check in on arrival.
4. Quizzes and feedback unlock once registered.
5. Everything works offline; attendees sync from the Formulus **Sync** tab.
6. The leaderboard and Faces wall only show other people **after** a sync.
7. Merge attendance pull requests in batches, rebuild, and publish a new bundle so the
   Attendance wall updates on everyone's device.

## Data collected

| Form | Fields |
| --- | --- |
| `register` | name, username, `registered_at`, selfie (photo attachment), favourite quote |
| `checkin` | name, username, `checked_in_at` |
| `quiz_open_source`, `quiz_about_ode` | name, username, `answered_at`, four answers, score, max score |
| `feedback` | name, username, `submitted_at`, 1–5 rating, free-text comment |

Selfies are shown to every attendee whose device has synced, on the Faces wall and the
home screen strip. The registration form states this before the photo is taken. Removing
a photo after the fact means deleting the observation server-side — there is no in-app
withdrawal flow yet.

## Known gaps

- The agenda in `app.js` still has placeholder copy and no date.
- No in-app refresh. Both the leaderboard and Faces tell people to sync from the Sync tab,
  and the faces lookup is cached for 30 seconds on top of that.
- English only; no `ui.json` `translations` blocks yet.
- No automated tests or CI.

## Contributing

Everyone is welcome, especially if this would be your first open source contribution —
see [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Open Data Ensemble
