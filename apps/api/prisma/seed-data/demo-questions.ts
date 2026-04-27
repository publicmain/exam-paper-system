// Demo / sample questions for MVP — all school-original, no past paper content.
// Used for end-to-end testing and as a starting point for teachers.

export interface DemoQuestion {
  subjectCode: '9709' | '9702';
  componentCode: string;
  topicCode: string; // primary topic code; questions also auto-tagged with parents
  questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
  marks: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  content: { stem: string; parts?: { label: string; content: string; marks: number; answer: string }[] };
  answerContent: { text: string };
  options?: { key: string; text: string; correct: boolean }[];
  markScheme?: { point: string; marks: number }[];
}

export const DEMO_QUESTIONS_9709: DemoQuestion[] = [
  // ===== Quadratics =====
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.1.1',
    questionType: 'mcq', marks: 1, difficulty: 2,
    content: { stem: 'Express $x^2 - 6x + 11$ in completed-square form.' },
    answerContent: { text: '$(x-3)^2 + 2$' },
    options: [
      { key: 'A', text: '$(x-3)^2 + 2$', correct: true },
      { key: 'B', text: '$(x-3)^2 - 2$', correct: false },
      { key: 'C', text: '$(x-6)^2 + 11$', correct: false },
      { key: 'D', text: '$(x+3)^2 + 2$', correct: false },
    ],
  },
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.1.2',
    questionType: 'short_answer', marks: 3, difficulty: 3,
    content: { stem: 'Find the values of $k$ for which $kx^2 - 4x + k = 0$ has equal roots.' },
    answerContent: { text: 'Discriminant $= 16 - 4k^2 = 0$, so $k = \\pm 2$.' },
    markScheme: [
      { point: 'Sets discriminant = 0', marks: 1 },
      { point: 'Solves quadratic in $k$', marks: 1 },
      { point: 'States both values $k = \\pm 2$', marks: 1 },
    ],
  },
  // ===== Functions =====
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.2.3',
    questionType: 'structured', marks: 6, difficulty: 3,
    content: {
      stem: 'The function $f$ is defined by $f(x) = \\dfrac{2x+1}{x-3}$ for $x \\neq 3$.',
      parts: [
        { label: 'a', content: 'Find $f^{-1}(x)$.', marks: 3, answer: '$f^{-1}(x) = \\dfrac{3x+1}{x-2}$' },
        { label: 'b', content: 'State the range of $f^{-1}$.', marks: 1, answer: 'Range: $f^{-1}(x) \\neq 3$' },
        { label: 'c', content: 'Solve $f(x) = x$.', marks: 2, answer: '$x = -1$ or $x = 3$ (reject $x=3$), so $x=-1$' },
      ],
    },
    answerContent: { text: 'See parts.' },
  },
  // ===== Coordinate geometry =====
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.3.2',
    questionType: 'short_answer', marks: 4, difficulty: 3,
    content: { stem: 'Find the centre and radius of the circle $x^2 + y^2 - 6x + 8y - 11 = 0$.' },
    answerContent: { text: 'Centre $(3,-4)$, radius $6$.' },
    markScheme: [
      { point: 'Completes square in $x$', marks: 1 },
      { point: 'Completes square in $y$', marks: 1 },
      { point: 'States centre $(3,-4)$', marks: 1 },
      { point: 'States radius $6$', marks: 1 },
    ],
  },
  // ===== Trigonometry =====
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.5.1',
    questionType: 'mcq', marks: 1, difficulty: 2,
    content: { stem: 'Solve $2\\sin\\theta = 1$ for $0 \\le \\theta \\le 2\\pi$.' },
    answerContent: { text: '$\\theta = \\pi/6$ or $5\\pi/6$' },
    options: [
      { key: 'A', text: '$\\pi/6, 5\\pi/6$', correct: true },
      { key: 'B', text: '$\\pi/3, 2\\pi/3$', correct: false },
      { key: 'C', text: '$\\pi/4, 3\\pi/4$', correct: false },
      { key: 'D', text: '$\\pi/6$ only', correct: false },
    ],
  },
  // ===== Series =====
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.6.1',
    questionType: 'short_answer', marks: 3, difficulty: 3,
    content: { stem: 'Find the coefficient of $x^4$ in the expansion of $(2 + 3x)^6$.' },
    answerContent: { text: '$\\binom{6}{4}(2)^2(3)^4 = 15 \\cdot 4 \\cdot 81 = 4860$' },
  },
  // ===== Differentiation =====
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.7.2',
    questionType: 'structured', marks: 7, difficulty: 4,
    content: {
      stem: 'A curve has equation $y = x^3 - 3x^2 - 9x + 5$.',
      parts: [
        { label: 'a', content: 'Find $\\dfrac{dy}{dx}$.', marks: 1, answer: '$3x^2 - 6x - 9$' },
        { label: 'b', content: 'Find the coordinates of the stationary points.', marks: 4, answer: 'Max $(-1, 10)$, Min $(3, -22)$' },
        { label: 'c', content: 'Determine the nature of each stationary point.', marks: 2, answer: '$y\'\'(-1) = -12 < 0$ max; $y\'\'(3) = 12 > 0$ min' },
      ],
    },
    answerContent: { text: 'See parts.' },
  },
  // ===== Integration =====
  {
    subjectCode: '9709', componentCode: 'P1', topicCode: 'P1.8.2',
    questionType: 'short_answer', marks: 4, difficulty: 3,
    content: { stem: 'Find the area enclosed by $y = 4x - x^2$ and the $x$-axis.' },
    answerContent: { text: '$\\int_0^4 (4x - x^2)\\,dx = \\left[2x^2 - \\frac{x^3}{3}\\right]_0^4 = \\frac{32}{3}$' },
  },
  // ===== P3 advanced =====
  {
    subjectCode: '9709', componentCode: 'P3', topicCode: 'P3.1.3',
    questionType: 'short_answer', marks: 4, difficulty: 4,
    content: { stem: 'Express $\\dfrac{3x+5}{(x+1)(x-2)}$ in partial fractions.' },
    answerContent: { text: '$\\dfrac{-2/3}{x+1} + \\dfrac{11/3}{x-2}$' },
  },
  {
    subjectCode: '9709', componentCode: 'P3', topicCode: 'P3.5.2',
    questionType: 'short_answer', marks: 4, difficulty: 4,
    content: { stem: 'Evaluate $\\int_0^1 x e^x \\, dx$ using integration by parts.' },
    answerContent: { text: '$\\left[xe^x\\right]_0^1 - \\int_0^1 e^x dx = e - (e - 1) = 1$' },
  },
  // ===== M1 =====
  {
    subjectCode: '9709', componentCode: 'M1', topicCode: 'M1.2',
    questionType: 'mcq', marks: 1, difficulty: 2,
    content: { stem: 'A particle moves with $v = 3t^2 - 6t$ m/s. Its acceleration at $t = 2$ s is:' },
    answerContent: { text: '$a = 6t - 6 = 6$ m/s²' },
    options: [
      { key: 'A', text: '$0$ m/s²', correct: false },
      { key: 'B', text: '$6$ m/s²', correct: true },
      { key: 'C', text: '$12$ m/s²', correct: false },
      { key: 'D', text: '$-6$ m/s²', correct: false },
    ],
  },
  // ===== S1 =====
  {
    subjectCode: '9709', componentCode: 'S1', topicCode: 'S1.5',
    questionType: 'short_answer', marks: 3, difficulty: 3,
    content: { stem: 'If $X \\sim N(50, 16)$, find $P(X > 54)$.' },
    answerContent: { text: '$Z = (54-50)/4 = 1$, $P(Z>1) \\approx 0.1587$' },
  },
];

export const DEMO_QUESTIONS_9702: DemoQuestion[] = [
  // ===== Kinematics =====
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.2.1',
    questionType: 'mcq', marks: 1, difficulty: 2,
    content: { stem: 'A car accelerates from rest at $2.0\\,\\mathrm{m/s^2}$. The distance travelled in $5.0\\,\\mathrm{s}$ is:' },
    answerContent: { text: '$s = \\tfrac{1}{2}at^2 = 25\\,\\mathrm{m}$' },
    options: [
      { key: 'A', text: '$10\\,\\mathrm{m}$', correct: false },
      { key: 'B', text: '$20\\,\\mathrm{m}$', correct: false },
      { key: 'C', text: '$25\\,\\mathrm{m}$', correct: true },
      { key: 'D', text: '$50\\,\\mathrm{m}$', correct: false },
    ],
  },
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.2.2',
    questionType: 'structured', marks: 6, difficulty: 3,
    content: {
      stem: 'A ball is projected horizontally from a cliff of height $45\\,\\mathrm{m}$ with speed $15\\,\\mathrm{m/s}$. (Take $g = 10\\,\\mathrm{m/s^2}$, ignore air resistance.)',
      parts: [
        { label: 'a', content: 'Calculate the time to reach the ground.', marks: 2, answer: '$45 = \\tfrac{1}{2}(10)t^2 \\Rightarrow t = 3\\,\\mathrm{s}$' },
        { label: 'b', content: 'Calculate the horizontal range.', marks: 2, answer: '$R = 15 \\times 3 = 45\\,\\mathrm{m}$' },
        { label: 'c', content: 'Calculate the speed when it hits the ground.', marks: 2, answer: '$v_y = 30\\,\\mathrm{m/s}$, $v = \\sqrt{15^2 + 30^2} \\approx 33.5\\,\\mathrm{m/s}$' },
      ],
    },
    answerContent: { text: 'See parts.' },
  },
  // ===== Dynamics =====
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.3.1',
    questionType: 'short_answer', marks: 3, difficulty: 2,
    content: { stem: 'A force of $20\\,\\mathrm{N}$ acts on a $4\\,\\mathrm{kg}$ object on a smooth surface. Friction is negligible. Find the acceleration.' },
    answerContent: { text: '$a = F/m = 20/4 = 5\\,\\mathrm{m/s^2}$' },
  },
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.3.2',
    questionType: 'structured', marks: 5, difficulty: 4,
    content: {
      stem: 'A ball of mass $0.5\\,\\mathrm{kg}$ moving at $4\\,\\mathrm{m/s}$ collides head-on with a stationary ball of mass $1.0\\,\\mathrm{kg}$. After collision they stick together.',
      parts: [
        { label: 'a', content: 'Find the common velocity after collision.', marks: 3, answer: '$0.5 \\times 4 = 1.5 v \\Rightarrow v = 4/3\\,\\mathrm{m/s}$' },
        { label: 'b', content: 'Calculate the loss of kinetic energy.', marks: 2, answer: '$\\Delta KE = 4 - 4/3 = 8/3\\,\\mathrm{J}$' },
      ],
    },
    answerContent: { text: 'See parts.' },
  },
  // ===== Energy =====
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.5',
    questionType: 'mcq', marks: 1, difficulty: 1,
    content: { stem: 'Which of the following is the SI unit of power?' },
    answerContent: { text: 'Watt (W) = J/s' },
    options: [
      { key: 'A', text: 'Joule', correct: false },
      { key: 'B', text: 'Newton', correct: false },
      { key: 'C', text: 'Watt', correct: true },
      { key: 'D', text: 'Pascal', correct: false },
    ],
  },
  // ===== Waves =====
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.7.1',
    questionType: 'short_answer', marks: 3, difficulty: 2,
    content: { stem: 'A wave has frequency $250\\,\\mathrm{Hz}$ and wavelength $1.4\\,\\mathrm{m}$. Calculate its speed.' },
    answerContent: { text: '$v = f\\lambda = 250 \\times 1.4 = 350\\,\\mathrm{m/s}$' },
  },
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.8.2',
    questionType: 'structured', marks: 5, difficulty: 3,
    content: {
      stem: 'In a Young\'s double-slit experiment, slits are $0.5\\,\\mathrm{mm}$ apart, screen is $2.0\\,\\mathrm{m}$ away, and fringe spacing is $2.4\\,\\mathrm{mm}$.',
      parts: [
        { label: 'a', content: 'Calculate the wavelength of light used.', marks: 3, answer: '$\\lambda = ax/D = (0.5\\times10^{-3})(2.4\\times10^{-3})/2 = 600\\,\\mathrm{nm}$' },
        { label: 'b', content: 'State what happens to fringe spacing if slit separation is halved.', marks: 2, answer: 'Fringe spacing doubles to $4.8\\,\\mathrm{mm}$' },
      ],
    },
    answerContent: { text: 'See parts.' },
  },
  // ===== Electricity =====
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.9.1',
    questionType: 'mcq', marks: 1, difficulty: 1,
    content: { stem: 'A current of $2.0\\,\\mathrm{A}$ flows through a resistor for $30\\,\\mathrm{s}$. Charge transferred is:' },
    answerContent: { text: '$Q = It = 60\\,\\mathrm{C}$' },
    options: [
      { key: 'A', text: '$15\\,\\mathrm{C}$', correct: false },
      { key: 'B', text: '$30\\,\\mathrm{C}$', correct: false },
      { key: 'C', text: '$60\\,\\mathrm{C}$', correct: true },
      { key: 'D', text: '$120\\,\\mathrm{C}$', correct: false },
    ],
  },
  {
    subjectCode: '9702', componentCode: 'AS', topicCode: 'PH.9.2',
    questionType: 'structured', marks: 6, difficulty: 4,
    content: {
      stem: 'Two resistors $R_1 = 4\\,\\Omega$ and $R_2 = 6\\,\\Omega$ are connected in parallel across a $12\\,\\mathrm{V}$ battery (negligible internal resistance).',
      parts: [
        { label: 'a', content: 'Find the equivalent resistance.', marks: 2, answer: '$R = (4\\times6)/(4+6) = 2.4\\,\\Omega$' },
        { label: 'b', content: 'Find the total current from the battery.', marks: 2, answer: '$I = 12/2.4 = 5\\,\\mathrm{A}$' },
        { label: 'c', content: 'Find the power dissipated in $R_1$.', marks: 2, answer: '$P = V^2/R = 144/4 = 36\\,\\mathrm{W}$' },
      ],
    },
    answerContent: { text: 'See parts.' },
  },
  // ===== A2 — Circular motion =====
  {
    subjectCode: '9702', componentCode: 'A2', topicCode: 'PH.11',
    questionType: 'short_answer', marks: 3, difficulty: 3,
    content: { stem: 'A car of mass $1200\\,\\mathrm{kg}$ travels at $20\\,\\mathrm{m/s}$ around a curve of radius $50\\,\\mathrm{m}$. Calculate the centripetal force needed.' },
    answerContent: { text: '$F = mv^2/r = 1200 \\times 400/50 = 9600\\,\\mathrm{N}$' },
  },
  // ===== Capacitance =====
  {
    subjectCode: '9702', componentCode: 'A2', topicCode: 'PH.18',
    questionType: 'short_answer', marks: 3, difficulty: 3,
    content: { stem: 'A $100\\,\\mu\\mathrm{F}$ capacitor is charged to $50\\,\\mathrm{V}$. Calculate the energy stored.' },
    answerContent: { text: '$E = \\tfrac{1}{2}CV^2 = 0.5 \\times 100\\times10^{-6} \\times 2500 = 0.125\\,\\mathrm{J}$' },
  },
];
