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
  { time: '9:00 – 9:30', title: 'Registration and snacks' },
  { time: '9:30 – 10:00', title: 'Intros & Program for the day' },
  { time: '10:00 – 12:00', title: 'The ODE Ecosystem' },
  { time: '12:00 – 12:30', title: 'LUNCH' },
  { time: '12:30 – 13:00', title: 'ODE LAB: Intro to group work' },
  { time: '13:00 – 15:00', title: 'ODE LAB: Work in groups' },
  { time: '15:00 – 16:00', title: 'ODE LAB: Present group work' },
  { time: '16:00 – 17:00', title: 'Work Readiness & Placement' },
  { time: '17:00 – 18:00', title: 'Wrap-up and open positions in ODE community' },
];
