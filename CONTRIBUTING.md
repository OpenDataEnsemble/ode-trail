# Contributing to ODE Trail

Welcome. If this is your first contribution to an open source project, you are in exactly
the right place — this project exists partly to walk you through it.

Your first task is to **add your name to the Attendance wall**. You will fork this
repository, clone it, make a branch, and open a pull request. A maintainer reviews and
merges it, a new release goes out, and your name appears inside the app on every phone in
the room.

That is the whole open source loop, and it is the same loop whether you are adding your
name to a list or shipping a feature to a project with a thousand contributors.

---

## Prerequisites

Three things, once. **Do this before the session if you can** — setup is where people lose
the most time.

**1. Git.** Check with `git --version`. If you need it:
[git-scm.com/downloads](https://git-scm.com/downloads).

**2. Tell git who you are.** On a fresh machine git does not know, and your first commit
will fail. Use the same email as your GitHub account:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

**3. Authentication.** This is where nearly everyone gets stuck. GitHub stopped accepting
account passwords on the command line years ago, so `git push` will reject yours with an
error that does not explain itself. The simplest fix is the GitHub CLI — install it from
[cli.github.com](https://cli.github.com/), then:

```bash
gh auth login
```

Choose **GitHub.com** → **HTTPS** → **Login with a web browser**. It configures git for you,
so pushing just works afterwards.

Prefer not to install it? Use an
[SSH key](https://docs.github.com/authentication/connecting-to-github-with-ssh) or a
[personal access token](https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
instead of your password.

---

## Add your name

### 1. Fork

A fork is your own copy of the project on GitHub. You cannot push to someone else's
repository, so you change your copy and then ask for it to be pulled in.

Go to [github.com/OpenDataEnsemble/ode-trail](https://github.com/OpenDataEnsemble/ode-trail),
click **Fork**, then **Create fork**.

### 2. Clone your fork

Clone **your fork**, not the original. Cloning the original is the most common mistake here
and it leaves you unable to push later.

```bash
git clone https://github.com/YOUR-USERNAME/ode-trail.git
cd ode-trail
```

Replace `YOUR-USERNAME`. The exact URL is under the green **Code** button on your fork.

### 3. Point at the original

Your clone knows about your fork as `origin`. Add the original as `upstream` so you can pull
in other people's changes later:

```bash
git remote add upstream https://github.com/OpenDataEnsemble/ode-trail.git
git remote -v          # should list both origin and upstream
```

### 4. Make a branch

Never work on `main`. A branch keeps your change separate and lets you have more than one in
flight:

```bash
git switch -c add-your-name
```

### 5. Add yourself

Open [`app/attendees.js`](app/attendees.js). Find the comment for the first letter of your
name and add one line beneath it:

```js
  // --- D-F ---
  { name: 'Dara Kim', github: 'darakim' },
```

`name` is required. `github` is your handle without the `@` and is optional —
`{ name: 'Dara Kim' },` is fine. Keep the quotes and the trailing comma.

Filing under the right letter is what lets many people contribute at once without their
changes colliding.

### 6. Commit

Look at what you changed before you commit it. That habit will serve you for the rest of
your career:

```bash
git status
git diff
git add app/attendees.js
git commit -m "docs: add Dara Kim to the attendance wall"
```

### 7. Push to your fork

```bash
git push -u origin add-your-name
```

Rejected, or asked for a password that does not work? See
[Prerequisites](#prerequisites).

### 8. Open the pull request

Git prints a link when you push — open it and you get a pre-filled pull request form.
Otherwise go to your fork on GitHub and click **Compare & pull request**.

Fill in the title, tick the boxes in the template, and click **Create pull request**.

### 9. Respond to review

A maintainer may leave a comment. This is normal, it is not criticism, and it happens to
everyone on every project. To make a change, edit the file and push again:

```bash
git add app/attendees.js
git commit -m "docs: fix missing comma"
git push
```

The pull request updates itself. Do not open a new one.

### 10. After it is merged

Tidy up and bring your fork back in line:

```bash
git switch main
git pull upstream main
git push origin main
git branch -d add-your-name
```

Then watch for the next release. Once a host publishes the new app bundle and you sync from
the **Sync** tab in Formulus, your name is on the wall on every phone in the room.

---

## If your pull request conflicts

GitHub says the branch cannot be merged automatically. Someone changed the same part of the
file after you started. Routine, and fixable:

```bash
git fetch upstream
git rebase upstream/main
```

Git stops and marks the clash in `app/attendees.js` with `<<<<<<<`, `=======` and `>>>>>>>`.
Open it, delete those marker lines, and keep both names — yours and theirs. Then:

```bash
git add app/attendees.js
git rebase --continue
git push --force-with-lease
```

If that is unnerving, say so on the pull request. A maintainer can fix it on your branch and
will happily do so.

---

## If you get stuck

Nothing here is destructive. Worst case, delete your fork and start again.

| Problem | What to do |
| --- | --- |
| `git push` rejected, or a password that never works | Authentication is not set up — see [Prerequisites](#prerequisites). |
| `remote: Permission denied` | You cloned the original instead of your fork. Check `git remote -v`. |
| `Please tell me who you are` | Set `user.name` and `user.email`. |
| Merge conflict | [See above](#if-your-pull-request-conflicts), or ask on the pull request. |
| Genuinely stuck and running out of time | Ask a host. If all else fails you can edit `app/attendees.js` [directly on GitHub][web-edit] — the pencil icon does the fork, branch, and pull request for you. It is the same result, you just do not see the machinery. |
| Still nothing | Open an issue with the **Add me to the attendance wall** template and a maintainer will add you. No one gets left off the wall. |

[web-edit]: https://github.com/OpenDataEnsemble/ode-trail/edit/main/app/attendees.js

---

## Contributing to the app itself

Bug reports and improvements are very welcome.

### Setup

You need **Node.js 18 or newer**. There are no npm dependencies.

```bash
npm run validate     # structural checks on the form definitions
npm run bundle       # writes app-bundles/bundle-v<version>.zip
```

The app is plain HTML, CSS, and JavaScript with no build step and no framework, so you can
read [`app/app.js`](app/app.js) top to bottom and understand all of it in a sitting.

To see changes running you need the **ODE Desktop** workbench in developer mode — point it
at the `app/` folder, not the repository root — or a Formulus device with the bundle
installed. In an ordinary browser the app reports that the Formulus bridge is unavailable,
which is expected.

### Before you open a pull request

- Run `npm run validate` if you touched anything under `forms/`.
- Keep the existing style: no framework, no build step, no dependencies. That constraint is
  deliberate — it is what makes this app readable as a teaching example.
- One logical change per pull request.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/), like the rest of Open
Data Ensemble:

```
feat: add a refresh button to the leaderboard
fix: stop the check-in row staying tappable after submission
docs: clarify the attendance flow
```

Forget, and a maintainer will tidy it up on merge. It is never a reason to hold back a
contribution.

### Looking for something to work on

Try the [`good first issue`][gfi] label, or the **Known gaps** section of the
[README](README.md#known-gaps) — those are real, unfinished, and yours for the taking.

[gfi]: https://github.com/OpenDataEnsemble/ode-trail/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22

---

## Code of conduct

Everyone taking part follows our [Code of Conduct](CODE_OF_CONDUCT.md). Be kind, and be
especially kind to people making their first contribution.

## Questions

Open an issue, or email <hello@opendataensemble.org>. There is no such thing as a question
that is too basic here.
