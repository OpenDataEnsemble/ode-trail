export const QUIZZES = {
  quiz_open_source: {
    formType: 'quiz_open_source',
    title: 'Open source basics',
    questions: ['q1', 'q2', 'q3', 'q4'],
    answers: {
      q1: 'anyone_can_view',
      q2: 'contribute_changes',
      q3: 'pull_request',
      q4: 'mit',
    },
  },
  quiz_about_ode: {
    formType: 'quiz_about_ode',
    title: 'About ODE',
    questions: ['q1', 'q2', 'q3', 'q4'],
    answers: {
      q1: 'formulus',
      q2: 'synkronus',
      q3: 'keeps_working',
      q4: 'syncs_to_server',
    },
  },
};

export const QUIZ_ORDER = ['quiz_open_source', 'quiz_about_ode'];
export const POINTS = { checkin: 2, feedback: 2 };
export const REPO_URL = 'github.com/OpenDataEnsemble/ode-trail';

export const ABOUT_ODE = [
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

export const AGENDA = [
  {
    time: '9:00',
    title: 'Registration & check-in',
    desc: 'Get your badge, register in the app, then tap Check in once you’re here.',
  },
  { time: '9:30', title: 'Welcome', desc: 'What today is about.' },
  { time: '10:00', title: 'Open source 101', desc: 'Take the quiz right after.' },
  { time: '11:00', title: 'Meet ODE', desc: 'A live look at ODE in action.' },
  { time: '13:00', title: 'Hands-on lab', desc: 'Build something with the team.' },
  { time: '15:30', title: 'Panel & wrap-up', desc: 'Questions, feedback, and thank-yous.' },
];
