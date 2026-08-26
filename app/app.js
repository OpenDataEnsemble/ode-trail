// ODE Trail — app logic. Plain JS, no build step, no framework.
// Formplayer (inside Formulus) renders every form; this file only decides
// which form to open next and keeps track of what's been done.

(function () {
  'use strict';

  // persistObservation, used to stamp quiz scores, is only available from
  // this Formulus interface version onwards.
  var MIN_FORMULUS_VERSION = '1.3.0';

  // ---------------------------------------------------------------------
  // Content — edit these to change what people see, no code changes needed
  // ---------------------------------------------------------------------

  var QUIZZES = {
    quiz_open_source: {
      formType: 'quiz_open_source',
      title: 'Open source basics',
      questions: ['q1', 'q2', 'q3', 'q4'],
      answers: { q1: 'anyone_can_view', q2: 'contribute_changes', q3: 'pull_request', q4: 'mit' },
    },
    quiz_about_ode: {
      formType: 'quiz_about_ode',
      title: 'About ODE',
      questions: ['q1', 'q2', 'q3', 'q4'],
      answers: { q1: 'formulus', q2: 'synkronus', q3: 'keeps_working', q4: 'syncs_to_server' },
    },
  };

  var QUIZ_ORDER = ['quiz_open_source', 'quiz_about_ode'];

  // Shown on the Attendance screen for people to type into a browser. Links
  // out of the WebView aren't guaranteed to open, so this stays plain text.
  var REPO_URL = 'github.com/OpenDataEnsemble/ode-trail';

  // Quizzes score a point per correct answer; these two are flat awards for
  // turning up and for telling us how it went. Total on offer: 12.
  var POINTS = { checkin: 2, feedback: 2 };

  var ABOUT_ODE = [
    {
      title: 'Formulus',
      body: 'The app you have open right now. It runs on your phone and keeps working with no signal at all.',
    },
    {
      title: 'Formplayer',
      body: 'The part of Formulus that shows you forms and quizzes, like the ones in ODE Trail.',
    },
    {
      title: 'Synkronus',
      body: "The server every Formulus app talks to. It's where everyone's answers end up once you're back online.",
    },
    {
      title: 'Offline-first',
      body: "Nothing you fill in today is lost without signal. It's saved to your phone first, then sent on once you sync.",
    },
    {
      title: 'Custom apps',
      body: 'ODE Trail is itself a small app built on ODE — the same way anyone can build their own on top of it.',
    },
  ];

  var AGENDA = [
    { time: '9:00', title: 'Registration & check-in', desc: 'Get your badge, register in the app, then tap Check in once you’re here.' },
    { time: '9:30', title: 'Welcome', desc: 'What today is about.' },
    { time: '10:00', title: 'Open source 101', desc: 'Take the quiz right after.' },
    { time: '11:00', title: 'Meet ODE', desc: 'A live look at ODE in action.' },
    { time: '13:00', title: 'Hands-on lab', desc: 'Build something with the team.' },
    { time: '15:30', title: 'Panel & wrap-up', desc: 'Questions, feedback, and thank-yous.' },
  ];

  // ---------------------------------------------------------------------
  // Storage — a cache of "where this person is", not the source of truth.
  // Observations on the device (and the server, after sync) are canonical;
  // hydrateProgress() rebuilds this from them.
  // ---------------------------------------------------------------------

  var STORAGE_KEY = 'odeTrail.v1';

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function defaultState() {
    return {
      identity: null, // { name, favouriteQuote, selfie, username, observationId }
      checkedIn: false,
      quizzes: {}, // quizKey -> { done, score, maxScore }
      feedbackDone: false,
    };
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage can fail (private mode, full disk) — the app still works,
      // it just won't remember progress across a restart. hydrateProgress()
      // recovers it from observations on the next launch.
    }
  }

  var state = loadState();
  var view = 'home';

  // Set when the host is too old for the APIs this app needs. Blocks the
  // actions that would fail halfway through rather than letting people
  // submit a form and lose the result.
  var hostIssue = null;

  // ---------------------------------------------------------------------
  // Bridge helpers
  // ---------------------------------------------------------------------

  var formulusPromise = null;
  function bridge() {
    if (!formulusPromise) formulusPromise = window.getFormulus();
    return formulusPromise;
  }

  function compareVersions(a, b) {
    var left = String(a || '').split('-')[0].split('.');
    var right = String(b || '').split('-')[0].split('.');
    for (var i = 0; i < 3; i++) {
      var l = parseInt(left[i], 10) || 0;
      var r = parseInt(right[i], 10) || 0;
      if (l !== r) return l > r ? 1 : -1;
    }
    return 0;
  }

  function checkHostVersion(api) {
    return api
      .getVersion()
      .then(function (version) {
        if (compareVersions(version, MIN_FORMULUS_VERSION) < 0) {
          hostIssue =
            'This version of Formulus (' +
            version +
            ') is too old for ODE Trail. Ask a host to update to ' +
            MIN_FORMULUS_VERSION +
            ' or newer.';
          render();
        }
      })
      .catch(function () {
        // Version unreadable — don't block the app on a failed probe.
      });
  }

  // One user-initiated flow at a time. Without this, a double tap opens two
  // Formplayer sessions and files two observations for the same action.
  var actionInFlight = false;

  function runExclusive(start) {
    if (actionInFlight) return;
    actionInFlight = true;
    var done = function () {
      actionInFlight = false;
    };
    try {
      Promise.resolve(start()).then(done, done);
    } catch (e) {
      done();
      throw e;
    }
  }

  function isSubmitted(result) {
    return !!result && (result.status === 'form_submitted' || result.status === 'form_updated');
  }

  function toastError(prefix, err) {
    var detail = err && err.message ? ': ' + err.message : '. Try again.';
    toast(prefix + detail);
  }

  function observationTime(obs) {
    if (!obs) return 0;
    var stamp = new Date(obs.updatedAt || obs.createdAt || 0).getTime();
    return isNaN(stamp) ? 0 : stamp;
  }

  // Scoring picks the *first* submission, so it has to order by creation:
  // stamping a quiz score with persistObservation bumps updatedAt, which
  // would otherwise make a first attempt look like the most recent one.
  function createdTime(obs) {
    if (!obs) return 0;
    var stamp = new Date(obs.createdAt || obs.updatedAt || 0).getTime();
    return isNaN(stamp) ? 0 : stamp;
  }

  function personKey(data) {
    return (data && (data.username || data.name)) || '';
  }

  function findByUsername(observations, username) {
    if (!username) return null;
    return (
      (observations || []).find(function (obs) {
        return obs.data && obs.data.username === username;
      }) || null
    );
  }

  // Every form carries the identity of whoever filled it in, so progress and
  // the leaderboard survive a cleared cache or a second device. The timestamp
  // records when the attendee started the task; each schema also declares
  // `default: "$now"` so a form opened straight from the Formulus forms list
  // still gets one.
  function identityStamp(timestampKey) {
    var stamp = {
      name: state.identity ? state.identity.name : '',
      username: state.identity ? state.identity.username : '',
    };
    stamp[timestampKey] = new Date().toISOString();
    return stamp;
  }

  function maxScore(quizKey) {
    return QUIZZES[quizKey].questions.length;
  }

  function scoreQuiz(quizKey, formData) {
    var quiz = QUIZZES[quizKey];
    var correct = 0;
    quiz.questions.forEach(function (q) {
      if (formData && formData[q] === quiz.answers[q]) correct += 1;
    });
    return correct;
  }

  // Answers are the source of truth for a score; the stored `score` field is
  // only a convenience for exports and may be missing if the stamp failed.
  function scoreFromObservation(quizKey, data) {
    var answered = QUIZZES[quizKey].questions.some(function (q) {
      return data && data[q] !== undefined;
    });
    if (answered) return scoreQuiz(quizKey, data);
    return data && typeof data.score === 'number' ? data.score : 0;
  }

  function pointsFor(formType, data) {
    if (formType === 'checkin') return POINTS.checkin;
    if (formType === 'feedback') return POINTS.feedback;
    var quizKey = quizKeyForFormType(formType);
    return quizKey ? scoreFromObservation(quizKey, data) : 0;
  }

  function myPoints() {
    var total = 0;
    if (state.checkedIn) total += POINTS.checkin;
    if (state.feedbackDone) total += POINTS.feedback;
    QUIZ_ORDER.forEach(function (quizKey) {
      var progress = state.quizzes[quizKey];
      if (progress && progress.done) total += progress.score;
    });
    return total;
  }

  function requireReady(needsIdentity) {
    if (hostIssue) {
      toast(hostIssue);
      return false;
    }
    if (needsIdentity && !state.identity) {
      toast('Register first to unlock the rest of the trail.');
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  // Cached progress can lag reality — storage cleared, a second device, or a
  // tap that lands before hydrateProgress() has finished. Disabling a
  // finished row in the UI is not enough on its own, so confirm against the
  // stored observations before opening a form that should only be filled once.
  function alreadySubmitted(api, formType) {
    var username = state.identity && state.identity.username;
    if (!username) return Promise.resolve(false);
    return api
      .getObservationsByQuery({ formType: formType })
      .then(function (observations) {
        return (observations || []).some(function (obs) {
          return obs.data && obs.data.username === username;
        });
      })
      .catch(function () {
        // Can't check right now; don't strand someone who hasn't done it yet.
        return false;
      });
  }

  function adoptIdentityFromObservation(obs, username) {
    var data = obs.data || {};
    state.identity = {
      name: data.name || '',
      favouriteQuote: data.favouriteQuote || '',
      selfie: data.selfie || null,
      username: username || data.username || '',
      observationId: obs.observationId,
    };
    saveState(state);
  }

  function register() {
    if (!requireReady(false)) return;
    runExclusive(function () {
      return bridge()
        .then(function (api) {
          return api.getCurrentUser().then(function (user) {
            var username = user && user.username ? user.username : '';
            // Without a signed-in account there is no stable key to
            // recognise this person by later, so don't create a record we
            // can't match back to them.
            if (!username) {
              toast('Sign in to Formulus before registering.');
              return null;
            }

            // Name always comes from the logged-in account — never typed —
            // so a returning person is always found by username alone, and
            // the form itself only needs to ask for a photo and a quote.
            var displayName = (user && (user.displayName || user.username)) || '';

            return api
              .getObservationsByQuery({ formType: 'register' })
              .catch(function () {
                return [];
              })
              .then(function (observations) {
                var existing = findByUsername(observations, username);

                if (existing) {
                  adoptIdentityFromObservation(existing, username);
                  toast("You're already registered as " + (state.identity.name || 'a returning attendee') + '.');
                  render();
                  return hydrateProgress();
                }

                // name and username are schema properties with no Control,
                // so Formplayer keeps them from defaultData and stores them
                // on submit. One write, no half-registered record if a
                // follow-up call were to fail.
                return api
                  .openFormplayer(
                    'register',
                    {
                      defaultData: {
                        name: displayName,
                        username: username,
                        registered_at: new Date().toISOString(),
                      },
                    },
                    {}
                  )
                  .then(function (result) {
                    if (!isSubmitted(result)) return;
                    var data = result.formData || {};
                    state.identity = {
                      name: data.name || displayName,
                      favouriteQuote: data.favouriteQuote || '',
                      selfie: data.selfie || null,
                      username: data.username || username,
                      observationId: result.observationId || null,
                    };
                    saveState(state);
                    toast('Thank you for registering, ' + state.identity.name + '!');
                    render();
                  });
              });
          });
        })
        .catch(function (err) {
          toastError("Couldn't open the registration form", err);
        });
    });
  }

  function checkIn() {
    if (!requireReady(true)) return;
    runExclusive(function () {
      return bridge()
        .then(function (api) {
          return alreadySubmitted(api, 'checkin').then(function (done) {
            if (done) {
              state.checkedIn = true;
              saveState(state);
              render();
              toast("You're already checked in.");
              return;
            }
            return api
              .openFormplayer('checkin', { defaultData: identityStamp('checked_in_at') }, {})
              .then(function (result) {
                if (!isSubmitted(result)) return;
                state.checkedIn = true;
                saveState(state);
                toast('Welcome to the ODE Community, ' + state.identity.name + '!');
                render();
              });
          });
        })
        .catch(function (err) {
          toastError("Couldn't open check-in", err);
        });
    });
  }

  function startQuiz(quizKey) {
    if (!requireReady(true)) return;
    var quiz = QUIZZES[quizKey];
    runExclusive(function () {
      return bridge()
        .then(function (api) {
          return alreadySubmitted(api, quiz.formType).then(function (done) {
            if (done) {
              toast("You've already taken that quiz — your first result counts.");
              return hydrateProgress();
            }
            return openQuiz(api, quizKey);
          });
        })
        .catch(function (err) {
          toastError("Couldn't open that quiz", err);
        });
    });
  }

  function openQuiz(api, quizKey) {
    var quiz = QUIZZES[quizKey];
    return api
      .openFormplayer(quiz.formType, { defaultData: identityStamp('answered_at') }, {})
      .then(function (result) {
        if (!isSubmitted(result)) return;
        var score = scoreQuiz(quizKey, result.formData);
        var total = maxScore(quizKey);

        // The answers are already stored at this point, so record the result
        // locally before the score stamp — a failed stamp must not make a
        // completed quiz look unfinished and invite a duplicate retake.
        state.quizzes[quizKey] = { done: true, score: score, maxScore: total };
        saveState(state);
        toast('Scored ' + score + '/' + total + ' — nice.');
        render();

        if (!result.observationId) return;
        return api
          .persistObservation({
            formType: quiz.formType,
            observationId: result.observationId,
            finalData: Object.assign({}, result.formData, { score: score, max_score: total }),
          })
          .catch(function () {
            // Leaderboard recomputes from the answers, so a missing score
            // field costs nothing visible here.
          });
      });
  }

  function startFeedback() {
    if (!requireReady(true)) return;
    runExclusive(function () {
      return bridge()
        .then(function (api) {
          return alreadySubmitted(api, 'feedback').then(function (done) {
            if (done) {
              state.feedbackDone = true;
              saveState(state);
              render();
              toast("You've already shared your feedback — thank you.");
              return;
            }
            return api
              .openFormplayer('feedback', { defaultData: identityStamp('submitted_at') }, {})
              .then(function (result) {
                if (!isSubmitted(result)) return;
                state.feedbackDone = true;
                saveState(state);
                toast('Thanks for the feedback!');
                render();
              });
          });
        })
        .catch(function (err) {
          toastError("Couldn't open the feedback form", err);
        });
    });
  }

  // Formulus watches this webview's browser history (pushState/popstate) to
  // decide what its hardware/native back button does: if we never push any
  // history, it always treats back as "leave the app". So every forward
  // navigation (home -> a subview) pushes a history entry, and the "Home"
  // link goes back through that entry with history.back() instead of
  // pushing a new one — that keeps our view in sync with Formulus's back
  // button, and only home (depth 0) falls through to its exit prompt.
  var HISTORY_SUPPORTED = typeof window.history !== 'undefined' && typeof window.history.pushState === 'function';

  function goTo(next) {
    view = next;
    // Push a genuinely different URL (a hash), not just a state object on the
    // same URL — real path per screen is the better-tested case for native
    // back-button tracking than same-URL, state-only history entries.
    if (HISTORY_SUPPORTED) history.pushState({ view: next }, '', '#' + next);
    render();
  }

  function goBack() {
    if (HISTORY_SUPPORTED) {
      history.back();
    } else {
      goTo('home');
    }
  }

  if (HISTORY_SUPPORTED) {
    history.replaceState({ view: 'home' }, '', '#home');
    window.addEventListener('popstate', function (event) {
      view = (event.state && event.state.view) || 'home';
      render();
    });
  }

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------

  var toastTimer = null;
  function toast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.textContent = message;
    document.body.appendChild(node);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.remove();
    }, 2600);
  }

  // ---------------------------------------------------------------------
  // Rendering — plain DOM building, no templating library
  // ---------------------------------------------------------------------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      if (attrs[key] === null || attrs[key] === undefined) return;
      if (key === 'text') {
        node.textContent = attrs[key];
      } else if (key.indexOf('on') === 0 && typeof attrs[key] === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
      } else {
        node.setAttribute(key, attrs[key]);
      }
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function loadingBlock() {
    return el('div', { class: 'empty', role: 'status', text: 'Loading…' });
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function chevronLeft() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M15 18l-6-6 6-6');
    svg.appendChild(path);
    return svg;
  }

  // Subviews get the back control inside the header row rather than on a line
  // of its own, so there's one bar at the top of every screen instead of two.
  function header(subtitle, withBack) {
    var children = [];
    if (withBack) {
      children.push(
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', onclick: goBack }, [chevronLeft()])
      );
    }
    children.push(
      el('img', { src: 'assets/ode-logo.png', alt: 'ODE', width: '44', height: '44', decoding: 'async' })
    );
    children.push(
      el('div', { class: 'header-text' }, [
        el('h1', { text: 'ODE Trail' }),
        el('p', { text: subtitle || 'Open Data Ensemble Community Day' }),
      ])
    );
    return el('div', { class: 'header' }, children);
  }

  function renderHome() {
    var container = el('div', {});
    container.appendChild(header());

    if (hostIssue) {
      container.appendChild(
        el('div', { class: 'card notice', role: 'alert' }, [
          el('h2', { text: 'Update needed' }),
          el('p', { text: hostIssue }),
        ])
      );
    }

    if (!state.identity) {
      container.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { text: 'Get started' }),
          el('p', {
            text:
              'Register, then collect points by checking in, taking the quizzes, and telling us how ' +
              'the day went. Your name and selfie appear on the Faces wall for other attendees ' +
              'during the event.',
          }),
          el('button', { class: 'btn btn-primary', type: 'button', text: 'Register', onclick: register }),
        ])
      );
    } else {
      container.appendChild(renderProfileCard());
    }

    container.appendChild(el('h2', { class: 'section-title', text: 'Community' }));
    var communityHolder = el('div', {}, [loadingBlock()]);
    container.appendChild(communityHolder);
    loadCommunityStrip(communityHolder);
    container.appendChild(
      el('button', {
        class: 'link-btn',
        type: 'button',
        text: 'See everyone →',
        onclick: function () {
          goTo('faces');
        },
      })
    );

    if (state.identity) {
      container.appendChild(el('h2', { class: 'section-title', text: 'Today' }));
      container.appendChild(
        actionItem({
          label: 'Check in',
          sub: state.checkedIn ? null : 'Tap once you arrive at the venue. Worth ' + POINTS.checkin + ' points.',
          done: state.checkedIn,
          doneLabel: '+' + POINTS.checkin + ' points',
          pendingLabel: 'Tap to check in',
          onClick: checkIn,
        })
      );

      container.appendChild(el('h2', { class: 'section-title', text: 'Quizzes' }));
      QUIZ_ORDER.forEach(function (quizKey) {
        var quiz = QUIZZES[quizKey];
        var progress = state.quizzes[quizKey];
        container.appendChild(
          actionItem({
            label: quiz.title,
            sub:
              progress && progress.done
                ? null
                : 'A few quick questions. A point for each right answer.',
            done: !!(progress && progress.done),
            doneLabel: progress ? progress.score + '/' + progress.maxScore : '',
            pendingLabel: 'Take quiz',
            onClick: function () {
              startQuiz(quizKey);
            },
          })
        );
      });

      container.appendChild(el('h2', { class: 'section-title', text: 'Feedback' }));
      container.appendChild(
        actionItem({
          label: 'How was today?',
          sub: state.feedbackDone
            ? null
            : 'Rate the day and tell us what you think. Worth ' + POINTS.feedback + ' points.',
          done: state.feedbackDone,
          doneLabel: '+' + POINTS.feedback + ' points',
          pendingLabel: 'Share feedback',
          onClick: startFeedback,
        })
      );
    }

    var nav = el('nav', { class: 'nav-grid', 'aria-label': 'More' }, [
      el('button', { class: 'btn btn-outline', type: 'button', text: 'Agenda', onclick: function () { goTo('agenda'); } }),
      el('button', { class: 'btn btn-outline', type: 'button', text: 'About ODE', onclick: function () { goTo('about'); } }),
      el('button', { class: 'btn btn-outline', type: 'button', text: 'Leaderboard', onclick: function () { goTo('leaderboard'); } }),
      el('button', { class: 'btn btn-outline', type: 'button', text: 'Faces', onclick: function () { goTo('faces'); } }),
      el('button', { class: 'btn btn-outline', type: 'button', text: 'Attendance', onclick: function () { goTo('attendance'); } }),
    ]);
    container.appendChild(nav);

    return container;
  }

  function actionItem(opts) {
    var statusEl = el('span', {
      class: 'status' + (opts.done ? ' done' : ' pending'),
      text: opts.done ? opts.doneLabel || 'Done' : opts.pendingLabel || 'Not yet',
    });
    var textWrap = el('span', { class: 'action-text' }, [
      el('span', { class: 'label', text: opts.label }),
      opts.sub ? el('span', { class: 'sub', text: opts.sub }) : null,
    ]);

    var attrs = { class: 'action-item', type: 'button' };
    if (opts.done || !opts.onClick) {
      // A finished task must not stay tappable: every extra tap files
      // another observation for the same thing.
      attrs.disabled = 'disabled';
      attrs['aria-disabled'] = 'true';
    } else {
      attrs.onclick = opts.onClick;
    }
    return el('button', attrs, [textWrap, statusEl]);
  }

  function renderProfileCard() {
    var initial = (state.identity.name || '?').charAt(0).toUpperCase();
    var photoWrap = el('div', { class: 'profile-photo-wrap' }, [
      el('div', { class: 'profile-placeholder', role: 'img', 'aria-label': state.identity.name || 'Your photo' }, [
        el('span', { text: initial, 'aria-hidden': 'true' }),
      ]),
    ]);
    var card = el('div', { class: 'card profile-card' }, [
      photoWrap,
      el('h3', { text: state.identity.name }),
      state.identity.favouriteQuote
        ? el('p', { class: 'profile-quote', text: '“' + state.identity.favouriteQuote + '”' })
        : null,
      el('p', { class: 'profile-status', text: myPoints() + ' points so far' }),
    ]);
    loadProfilePhoto(photoWrap);
    return card;
  }

  function loadProfilePhoto(container) {
    if (!state.identity || !state.identity.selfie || !state.identity.selfie.filename) return;
    bridge()
      .then(function (api) {
        return api.getAttachmentUri(state.identity.selfie.filename);
      })
      .then(function (uri) {
        if (!uri || !document.body.contains(container)) return; // no photo yet, or already navigated away
        container.innerHTML = '';
        container.appendChild(el('img', { src: uri, alt: state.identity.name || 'Your photo' }));
      })
      .catch(function () {
        // Leave the initial-letter placeholder in place.
      });
  }

  function renderAgenda() {
    var container = el('div', {});
    container.appendChild(header('Agenda', true));
    var card = el('div', { class: 'card' });
    AGENDA.forEach(function (item) {
      card.appendChild(
        el('div', { class: 'agenda-item' }, [
          el('div', { class: 'agenda-time', text: item.time }),
          el('div', {}, [
            el('div', { class: 'agenda-title', text: item.title }),
            el('div', { class: 'agenda-desc', text: item.desc }),
          ]),
        ])
      );
    });
    container.appendChild(card);
    return container;
  }

  function renderAbout() {
    var container = el('div', {});
    container.appendChild(header('About ODE', true));
    ABOUT_ODE.forEach(function (item) {
      container.appendChild(
        el('div', { class: 'card' }, [
          el('h2', { text: item.title }),
          el('p', { text: item.body }),
        ])
      );
    });
    return container;
  }

  // Unlike every other screen, this list doesn't come from observations or the
  // server — it ships inside the bundle (see attendees.js) and changes only
  // when someone's pull request is merged and a new bundle is published.
  function renderAttendance() {
    var container = el('div', {});
    container.appendChild(header('Attendance', true));

    var howTo = el('div', { class: 'card' }, [
      el('h2', { text: 'Sign the wall with a pull request' }),
      el('p', {
        text:
          'Every other list in this app is built from forms. This one is built from the ' +
          'repository itself — you put yourself on it by opening a pull request.',
      }),
      el('p', { class: 'repo-url', text: REPO_URL }),
    ]);

    var steps = el('ol', { class: 'steps' });
    [
      'Fork the repository above to your own GitHub account.',
      'Clone your fork and make a branch.',
      'Add your name to app/attendees.js, under the comment for your first letter.',
      'Commit, push, and open a pull request.',
    ].forEach(function (step) {
      steps.appendChild(el('li', { text: step }));
    });
    howTo.appendChild(steps);
    howTo.appendChild(
      el('p', {
        text:
          'Never done this before? CONTRIBUTING.md in the repository walks through every ' +
          'step, including the setup and what to do when something goes wrong.',
      })
    );
    howTo.appendChild(
      el('p', {
        text:
          'A host reviews and merges it, then publishes a new app bundle. Your name appears ' +
          'here on every phone at the next sync — an open source contribution, end to end.',
      })
    );
    container.appendChild(howTo);

    // Sorted here rather than trusting file order, so an entry filed under the
    // wrong letter still lands in the right place on the wall.
    var attendees = (window.ODE_TRAIL_ATTENDEES || [])
      .filter(function (person) {
        return person && person.name;
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });

    var listCard = el('div', { class: 'card' });
    if (!attendees.length) {
      listCard.appendChild(
        el('div', { class: 'empty', text: 'No one has signed the wall yet — be the first pull request.' })
      );
    } else {
      var list = el('ul', { class: 'attendee-list' });
      attendees.forEach(function (person) {
        list.appendChild(
          el('li', { class: 'attendee' }, [
            el('span', { class: 'attendee-name', text: person.name }),
            person.github ? el('span', { class: 'attendee-handle', text: '@' + person.github }) : null,
          ])
        );
      });
      listCard.appendChild(list);
    }
    container.appendChild(listCard);

    return container;
  }

  function renderLeaderboard() {
    var container = el('div', {});
    container.appendChild(header('Leaderboard', true));

    var card = el('div', { class: 'card' }, [
      el('p', {
        text:
          'Medals go to the top three overall and to the top three in each quiz. Points come from ' +
          'checking in, from every right answer, and from leaving feedback — so the overall winner ' +
          'is settled once the feedback is in. Your first attempt at a quiz is the one that counts, ' +
          'and equal points are split by whoever got there first.',
      }),
      el('p', {
        text: 'Everyone appears once their answers have synced — sync from the Sync tab to refresh.',
      }),
    ]);
    var listHolder = el('div', { class: 'card', id: 'leaderboard-list' }, [loadingBlock()]);
    container.appendChild(card);
    container.appendChild(listHolder);

    loadLeaderboard(listHolder);
    return container;
  }

  var RANKED_COUNT = 10;

  function loadLeaderboard(listHolder) {
    var scoringForms = ['checkin', 'feedback'].concat(
      QUIZ_ORDER.map(function (quizKey) {
        return QUIZZES[quizKey].formType;
      })
    );

    // Faces come from the register records, which is also where the selfies
    // live — the scoring forms only carry a name and a username.
    Promise.all([
      fetchFacesData().catch(function () {
        return [];
      }),
      bridge().then(function (api) {
        return Promise.all(
          scoringForms.map(function (formType) {
            return api
              .getObservationsByQuery({ formType: formType })
              .catch(function () {
                return [];
              })
              .then(function (observations) {
                return { formType: formType, observations: observations || [] };
              });
          })
        );
      }),
    ])
      .then(function (loaded) {
        var profiles = {};
        loaded[0].forEach(function (person) {
          if (person.key) profiles[person.key] = person;
        });

        var people = {};
        function personRow(key, fallbackName) {
          if (!people[key]) {
            var profile = profiles[key];
            people[key] = {
              key: key,
              name: (profile && profile.name) || fallbackName || key,
              uri: (profile && profile.uri) || null,
              score: 0,
              at: 0,
            };
          }
          return people[key];
        }

        var quizBoards = {};

        loaded[1].forEach(function (entry) {
          // One submission per person per form — the first one. Counting every
          // observation would let a retake, or the same answers synced from a
          // second device, move someone up the board.
          var firstPerPerson = {};
          entry.observations.forEach(function (obs) {
            var key = personKey(obs.data);
            if (!key) return;
            var current = firstPerPerson[key];
            if (!current || createdTime(obs) < createdTime(current)) {
              firstPerPerson[key] = obs;
            }
          });

          var quizKey = quizKeyForFormType(entry.formType);
          if (quizKey) quizBoards[quizKey] = [];

          Object.keys(firstPerPerson).forEach(function (key) {
            var obs = firstPerPerson[key];
            var data = obs.data || {};
            var points = pointsFor(entry.formType, data);
            var row = personRow(key, data.name);
            row.score += points;
            // Whoever finished last decides how quickly someone got through the
            // whole trail, which is what separates people on equal points.
            row.at = Math.max(row.at, createdTime(obs));

            if (quizKey && points > 0) {
              quizBoards[quizKey].push({
                key: key,
                name: row.name,
                uri: row.uri,
                score: points,
                at: createdTime(obs),
              });
            }
          });
        });

        // Equal points go to whoever got there first — an event needs one
        // winner per place, not a shared podium.
        function byScoreThenSpeed(a, b) {
          return b.score - a.score || a.at - b.at || a.name.localeCompare(b.name);
        }

        var rows = Object.keys(people).map(function (key) {
          return people[key];
        });
        rows.sort(byScoreThenSpeed);

        var quizzes = QUIZ_ORDER.filter(function (quizKey) {
          return (quizBoards[quizKey] || []).length;
        }).map(function (quizKey) {
          return {
            title: QUIZZES[quizKey].title,
            winners: quizBoards[quizKey].sort(byScoreThenSpeed).slice(0, 3),
          };
        });

        renderLeaderboardBoards(listHolder, {
          ranked: rows.slice(0, RANKED_COUNT),
          rest: rows.slice(RANKED_COUNT).sort(function (a, b) {
            return a.name.localeCompare(b.name);
          }),
          quizzes: quizzes,
        });
      })
      .catch(function () {
        listHolder.innerHTML = '';
        listHolder.appendChild(el('div', { class: 'empty', text: "Couldn't load the leaderboard." }));
      });
  }

  function leaderboardAvatar(row) {
    if (row.uri) {
      return el('img', { class: 'lb-avatar', src: row.uri, alt: '', loading: 'lazy', decoding: 'async' });
    }
    return el('span', { class: 'lb-avatar lb-avatar-empty', 'aria-hidden': 'true' }, [
      el('span', { text: (row.name || '?').charAt(0).toUpperCase() }),
    ]);
  }

  function leaderboardRow(row, rank, isMe) {
    var classes = ['leaderboard-row'];
    if (rank && rank <= 3) classes.push('podium', 'rank-' + rank);
    if (isMe) classes.push('me');

    return el('li', { class: classes.join(' ') }, [
      el('span', { class: 'lb-rank', text: rank ? String(rank) : '' }),
      leaderboardAvatar(row),
      el('span', { class: 'leaderboard-name' }, [
        el('span', { class: 'lb-name-text', text: row.name }),
        isMe ? el('span', { class: 'you-tag', text: 'You' }) : null,
      ]),
      el('span', { class: 'leaderboard-score', text: String(row.score) }),
    ]);
  }

  function renderLeaderboardBoards(listHolder, board) {
    listHolder.innerHTML = '';
    if (!board.ranked.length) {
      listHolder.appendChild(el('div', { class: 'empty', text: 'No points yet — be the first.' }));
      return;
    }

    var myKey = state.identity ? state.identity.username || state.identity.name : null;
    function isMe(row) {
      return !!myKey && row.key === myKey;
    }

    listHolder.appendChild(el('h3', { class: 'lb-subhead lb-subhead-first', text: 'Overall' }));
    var top = el('ol', { class: 'leaderboard' });
    board.ranked.forEach(function (row, index) {
      top.appendChild(leaderboardRow(row, index + 1, isMe(row)));
    });
    listHolder.appendChild(top);

    if (board.rest.length) {
      listHolder.appendChild(el('h3', { class: 'lb-subhead', text: 'Everyone else, A to Z' }));
      var others = el('ul', { class: 'leaderboard leaderboard-rest' });
      board.rest.forEach(function (row) {
        others.appendChild(leaderboardRow(row, null, isMe(row)));
      });
      listHolder.appendChild(others);
    }

    board.quizzes.forEach(function (quiz) {
      listHolder.appendChild(el('h3', { class: 'lb-subhead', text: quiz.title }));
      var winners = el('ol', { class: 'leaderboard' });
      quiz.winners.forEach(function (row, index) {
        winners.appendChild(leaderboardRow(row, index + 1, isMe(row)));
      });
      listHolder.appendChild(winners);
    });
  }

  function renderFaces() {
    var container = el('div', {});
    container.appendChild(header('Faces', true));

    var card = el('div', { class: 'card' }, [
      el('p', {
        text:
          'Everyone who has registered. Anyone whose selfie hasn’t synced to this ' +
          'device yet shows up as an initial for now — sync from the Sync tab to fill it in.',
      }),
    ]);
    var gridHolder = el('div', { class: 'card', id: 'faces-grid-holder' }, [loadingBlock()]);
    container.appendChild(card);
    container.appendChild(gridHolder);

    loadFaces(gridHolder);
    return container;
  }

  // Shared by the Faces screen and the Home "Community" strip so there's one
  // dedup/lookup implementation, not two. De-dupes to one entry per person
  // (by username, falling back to name for older records without one),
  // keeping whichever observation was updated most recently.
  var facesCache = null;
  var FACES_CACHE_MS = 30000;

  function fetchFacesData() {
    if (facesCache && Date.now() - facesCache.at < FACES_CACHE_MS) {
      return Promise.resolve(facesCache.people);
    }
    return bridge()
      .then(function (api) {
        return api
          .getObservationsByQuery({ formType: 'register' })
          .catch(function () {
            return [];
          })
          .then(function (observations) {
            var byPerson = {};
            (observations || []).forEach(function (obs) {
              var key = personKey(obs.data);
              if (!key) return;
              var current = byPerson[key];
              if (!current || observationTime(obs) >= observationTime(current)) {
                byPerson[key] = obs;
              }
            });

            return Promise.all(
              Object.keys(byPerson).map(function (key) {
                var data = byPerson[key].data || {};
                var name = data.name || '';
                var filename = data.selfie && data.selfie.filename;
                if (!filename) return { key: key, uri: null, name: name };
                return api
                  .getAttachmentUri(filename)
                  .then(function (uri) {
                    return { key: key, uri: uri || null, name: name };
                  })
                  .catch(function () {
                    return { key: key, uri: null, name: name };
                  });
              })
            );
          });
      })
      .then(function (people) {
        facesCache = { at: Date.now(), people: people };
        return people;
      });
  }

  function loadFaces(gridHolder) {
    fetchFacesData()
      .then(function (people) {
        renderFacesGrid(gridHolder, withNames(people));
      })
      .catch(function () {
        gridHolder.innerHTML = '';
        gridHolder.appendChild(el('div', { class: 'empty', text: "Couldn't load the photo wall." }));
      });
  }

  function loadCommunityStrip(container) {
    fetchFacesData()
      .then(function (people) {
        if (!document.body.contains(container)) return;
        renderCommunityStrip(container, withNames(people));
      })
      .catch(function () {
        // Quiet failure — a missing preview strip shouldn't block the rest
        // of Home from rendering.
        container.innerHTML = '';
      });
  }

  function withNames(people) {
    return (people || []).filter(function (p) {
      return p.name;
    });
  }

  function renderCommunityStrip(container, people) {
    container.innerHTML = '';
    if (!people.length) {
      container.appendChild(el('div', { class: 'empty', text: 'No one else yet — check back soon.' }));
      return;
    }
    var strip = el('ul', { class: 'community-strip' });
    people.forEach(function (person) {
      var avatar = person.uri
        ? el('img', { src: person.uri, alt: person.name, loading: 'lazy', decoding: 'async' })
        : el(
            'span',
            {
              class: 'face-placeholder community-placeholder',
              role: 'img',
              'aria-label': person.name,
            },
            [el('span', { text: person.name.charAt(0).toUpperCase(), 'aria-hidden': 'true' })]
          );
      strip.appendChild(el('li', { class: 'community-tile' }, [avatar]));
    });
    container.appendChild(strip);
  }

  function renderFacesGrid(gridHolder, people) {
    gridHolder.innerHTML = '';
    if (!people.length) {
      gridHolder.appendChild(el('div', { class: 'empty', text: 'No faces yet — be the first to register.' }));
      return;
    }
    var grid = el('ul', { class: 'faces-grid' });
    people.forEach(function (person) {
      var avatar = person.uri
        ? el('img', { src: person.uri, alt: '', loading: 'lazy', decoding: 'async' })
        : el('span', { class: 'face-placeholder', 'aria-hidden': 'true' }, [
            el('span', { text: person.name.charAt(0).toUpperCase() }),
          ]);
      grid.appendChild(el('li', { class: 'face-tile' }, [avatar, el('span', { class: 'face-name', text: person.name })]));
    });
    gridHolder.appendChild(grid);
  }

  // ---------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------

  var VIEWS = {
    home: renderHome,
    agenda: renderAgenda,
    about: renderAbout,
    leaderboard: renderLeaderboard,
    faces: renderFaces,
    attendance: renderAttendance,
  };

  function render() {
    var root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild((VIEWS[view] || renderHome)());
  }

  // ---------------------------------------------------------------------
  // Session — keep the cached identity and progress honest
  // ---------------------------------------------------------------------

  // state.identity is cached in this device's localStorage. If a different
  // person logs into Formulus on the same device, that stale identity would
  // keep being used for check-in/quiz/feedback submissions — attaching the
  // wrong name to the new person's data. So every time the app becomes
  // active, confirm the logged-in Formulus user still matches who
  // registered; if not, start fresh and re-adopt their own record.
  function refreshSession() {
    return bridge()
      .then(function (api) {
        return api.getCurrentUser().then(function (user) {
          var currentUsername = user && user.username ? user.username : '';
          var savedUsername = state.identity ? state.identity.username : '';

          if (state.identity && savedUsername && currentUsername && savedUsername !== currentUsername) {
            state = defaultState();
            saveState(state);
            facesCache = null;
            toast("You're signed in as a different user — please register again.");
            render();
          }

          if (state.identity || !currentUsername) return null;

          // No cached identity (new device, cleared storage, or just reset
          // above): recover it from this account's own register record.
          return api
            .getObservationsByQuery({ formType: 'register' })
            .catch(function () {
              return [];
            })
            .then(function (observations) {
              var existing = findByUsername(observations, currentUsername);
              if (!existing) return;
              adoptIdentityFromObservation(existing, currentUsername);
              render();
            });
        });
      })
      .then(hydrateProgress)
      .catch(function () {
        // Can't verify right now (offline / bridge not ready) — leave the
        // cached identity as-is rather than wiping it on a guess.
      });
  }

  function quizKeyForFormType(formType) {
    return (
      QUIZ_ORDER.find(function (quizKey) {
        return QUIZZES[quizKey].formType === formType;
      }) || null
    );
  }

  // Rebuild progress from this person's own observations, so a cleared cache
  // or a second device shows what they've actually done instead of offering
  // to check in (or take a quiz) all over again.
  function hydrateProgress() {
    if (!state.identity || !state.identity.username) return Promise.resolve();
    var username = state.identity.username;
    var formTypes = ['checkin', 'feedback'].concat(
      QUIZ_ORDER.map(function (quizKey) {
        return QUIZZES[quizKey].formType;
      })
    );

    return bridge()
      .then(function (api) {
        return Promise.all(
          formTypes.map(function (formType) {
            return api
              .getObservationsByQuery({ formType: formType })
              .catch(function () {
                return [];
              })
              .then(function (observations) {
                return {
                  formType: formType,
                  mine: (observations || []).filter(function (obs) {
                    return obs.data && obs.data.username === username;
                  }),
                };
              });
          })
        );
      })
      .then(function (results) {
        var changed = false;

        results.forEach(function (entry) {
          if (!entry.mine.length) return;

          if (entry.formType === 'checkin') {
            if (!state.checkedIn) {
              state.checkedIn = true;
              changed = true;
            }
            return;
          }

          if (entry.formType === 'feedback') {
            if (!state.feedbackDone) {
              state.feedbackDone = true;
              changed = true;
            }
            return;
          }

          var quizKey = quizKeyForFormType(entry.formType);
          if (!quizKey) return;
          var latest = entry.mine.reduce(function (best, obs) {
            return !best || observationTime(obs) >= observationTime(best) ? obs : best;
          }, null);
          var score = scoreFromObservation(quizKey, (latest && latest.data) || {});
          var existing = state.quizzes[quizKey];
          if (!existing || !existing.done || existing.score !== score) {
            state.quizzes[quizKey] = { done: true, score: score, maxScore: maxScore(quizKey) };
            changed = true;
          }
        });

        if (changed) {
          saveState(state);
          render();
        }
      })
      .catch(function () {
        // Best-effort only; the cached state stays usable offline.
      });
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  render();

  bridge()
    .then(function (api) {
      return checkHostVersion(api);
    })
    .then(refreshSession)
    .catch(function () {
      toast('Open this app inside Formulus to use it.');
    });

  // Re-check whenever the custom app regains focus (e.g. after switching to
  // Settings to log in as someone else, then back), not just on first load.
  // Formulus calls window.onReceiveFocus directly.
  var previousOnReceiveFocus = window.onReceiveFocus;
  window.onReceiveFocus = function () {
    if (typeof previousOnReceiveFocus === 'function') previousOnReceiveFocus();
    facesCache = null;
    return refreshSession();
  };
})();
